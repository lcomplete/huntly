import {isDebugging} from "./env";

export function log(...args: any[]) {
  if (isDebugging) {
    console.log(...args)
  }
}

export function logError(...args: any[]) {
  if (isDebugging) {
    console.error(...args)
  }
}

export function logWarn(...args: any[]) {
  if (isDebugging) {
    console.warn(...args)
  }
}

export function logInfo(...args: any[]) {
  if (isDebugging) {
    console.info(...args)
  }
}

export function logDebug(...args: any[]) {
  if (isDebugging) {
    console.debug(...args)
  }
}