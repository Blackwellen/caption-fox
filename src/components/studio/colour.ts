// Tailwind requires statically analysable class names — a template literal
// like `bg-${colour}-400` is invisible to the JIT scanner and renders nothing
// in production. This map keeps every colour class in the compiled output.

const DOT: Record<string, string> = {
  blue: 'bg-blue-400', green: 'bg-emerald-400', amber: 'bg-amber-400',
  violet: 'bg-violet-400', red: 'bg-red-400', slate: 'bg-slate-400',
}

export function collectionDotClass(colour: string): string {
  return DOT[colour] ?? DOT.slate
}
