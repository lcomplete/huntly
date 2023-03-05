export default function ConditionalWrapper({condition, wrapper, children}) {
  return condition ? wrapper(children) : children;
}