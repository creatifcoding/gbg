/** @jsxImportSource @opentui/react */
/**
 * Select Primitive
 *
 * Styled wrapper around OpenTUI's `<select>` component.
 */
import type { ReactNode } from "react"

// Re-export OpenTUI's native SelectOption type
import type { SelectOption, TabSelectOption } from "@opentui/core"
export type { SelectOption, TabSelectOption }

export interface SelectProps {
  options: SelectOption[]
  focused?: boolean
  onChange?: (index: number, option: SelectOption | null) => void
  onSelect?: (index: number, option: SelectOption | null) => void
}

export const Select = ({
  options,
  focused = false,
  onChange,
  onSelect,
}: SelectProps): ReactNode => {
  return (
    <select
      options={options}
      focused={focused}
      onChange={onChange}
      onSelect={onSelect}
    />
  )
}

export interface TabSelectProps {
  options: TabSelectOption[]
  focused?: boolean
  onChange?: (index: number, option: TabSelectOption | null) => void
}

export const TabSelect = ({
  options,
  focused = false,
  onChange,
}: TabSelectProps): ReactNode => {
  return (
    <tab-select
      options={options}
      focused={focused}
      onChange={onChange}
    />
  )
}
