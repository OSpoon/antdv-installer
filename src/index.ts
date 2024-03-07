import { join } from 'node:path'
import { cwd } from 'node:process'

import type {
  CodeBlockWriter,
  ImportDeclarationStructure,
  OptionalKind,
  SourceFile,
} from 'ts-morph'
import { Project, SyntaxKind } from 'ts-morph'
import shell from 'shelljs'
import ora from 'ora'

const spinner = ora({
  color: 'yellow',
})

const imports: OptionalKind<ImportDeclarationStructure>[] = [
  {
    defaultImport: 'Components',
    moduleSpecifier: 'unplugin-vue-components/vite',
  },
  {
    namedImports: ['AntDesignVueResolver'],
    moduleSpecifier: 'unplugin-vue-components/resolvers',
  },
]

function writerConfig(writer: CodeBlockWriter) {
  writer.write(`Components({
    resolvers: [
      AntDesignVueResolver({
        importStyle: false, // css in js
      }),
    ],
  })`)
}

/**
 * 导入目标模块
 * @param sourceFile
 */
function importModels(sourceFile: SourceFile) {
  sourceFile.getImportDeclarations().forEach((declaration) => {
    if (
      imports
        .map(imp => imp.moduleSpecifier)
        .includes(declaration.getModuleSpecifierValue())
    )
      declaration.remove()
  })
  sourceFile.addImportDeclarations(imports)
}

/**
 * 为 Vite 配置添加新的插件
 * @param sourceFile
 */
function handleCodeBlock(sourceFile: SourceFile) {
  for (const declaration of sourceFile.getDescendantsOfKind(
    SyntaxKind.Identifier,
  )) {
    if (!declaration.wasForgotten() && declaration.getText() === 'plugins') {
      declaration
        .getParent()
        .getChildrenOfKind(SyntaxKind.ArrayLiteralExpression)
        .forEach((array) => {
          const components = array.getElements().find((element) => {
            return element
              .getChildrenOfKind(SyntaxKind.Identifier)
              .find((identifier) => {
                return identifier.getText() === 'Components'
              })
          })
          components && array.removeElement(components)
          array.addElement(writerConfig)
        })
    }
  }
}

function installPlugin(filename: string) {
  const filePath = join(cwd(), filename || 'vite.config.ts')
  const project = new Project()

  const sourceFile = project.addSourceFileAtPath(filePath)

  importModels(sourceFile)
  handleCodeBlock(sourceFile)

  sourceFile.formatText()
  sourceFile.saveSync()
}

function installPkg(filename: string) {
  // 命令后增加 --color=always 参数可启用带颜色的输出
  const command = `npm install ant-design-vue@4.x --save && npm install unplugin-vue-components -D`

  spinner.start('[ANTDV] 初始化中 ...')
  shell.exec(command, {
    fatal: true,
    silent: true,
  }, (code: number) => {
    if (code === 0) {
      installPlugin(filename)
      spinner.stopAndPersist({
        text: '🎉 [ANTDV] 初始化完成 ~',
      })
    }
  })
}

export {
  installPkg,
  installPlugin,
}
