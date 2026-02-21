import { defineMacro, defineMacroProvider } from 'vite-plugin-macro'

const dbgMacro = defineMacro('dbg')
  .withSignature('<T>(arg: T): T', 'Log value with its source expression')
  .withHandler(function* ({ path, args }, { template, types, generate }) {
    if (args.length !== 1) {
      throw new Error('dbg expects exactly one argument')
    }

    // expand nested macros inside the argument first
    yield args

    const argPath = args[0]
    if (!argPath.isExpression()) {
      throw new Error('dbg argument must be an expression')
    }

    const label = argPath.isIdentifier()
      ? argPath.node.name
      : generate(argPath.node).code
    const valueId = path.scope.generateUidIdentifier('dbg')
    const build = template.expression(
      `(() => { 
        const %%id%% = %%expr%%; 
        console.group('dbg', %%label%%);
        console.debug(%%id%%);
        console.groupEnd();
        return %%id%%;
      })()`,
    )

    path.replaceWith(
      build({
        id: valueId,
        expr: argPath.node,
        label: types.stringLiteral(label),
      }),
    )
  })

export function provideDbg() {
  return defineMacroProvider({
    id: 'dbg',
    exports: {
      '@dbg': {
        macros: [dbgMacro],
      },
    },
  })
}
