export function safeInt(text: unknown, defaultValue = 0) {
  const str = text as string;
  const value = parseInt(str);
  return isNaN(value) ? defaultValue : value;
}

export function mapArrayTo<Source, Target>(sources: Source[], setter: (source: Source, target: Target) => void): Target[] {
  const targets: Target[] = [];
  sources.forEach(source => {
    const target = mapTo(source, setter);
    targets.push(target);
  })
  return targets;
}

export function mapTo<Source, Target>(source: Source, setter: (source: Source, target: Target) => void): Target {
  const target = {} as Target;
  Object.assign(target, source);
  setter(source,target);
  return target;
}