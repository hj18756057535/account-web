import type { zhCN } from './zh-CN'

type TranslationShape<T> = { [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]> }

export type Messages = TranslationShape<typeof zhCN>
