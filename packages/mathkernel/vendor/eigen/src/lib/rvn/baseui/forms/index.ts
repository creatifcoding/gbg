/**
 * RVN BaseUI Forms
 *
 * Brutalist form components built on @base-ui-components/react
 *
 * All components follow the RVN design language:
 * - 3px solid black borders
 * - 4px 4px box-shadow (removed on press)
 * - Sharp corners (no border-radius)
 * - Monospace for data/numbers
 * - Uppercase labels
 * - 12px minimum font size (THE FLOOR)
 * - Black/white high contrast
 * - Diagonal stripes for critical states
 */

// Accordion
export {
  RvnAccordion,
  RvnAccordionItem,
  RvnAccordionHeader,
  RvnAccordionPanel,
  Accordion,
} from './RvnAccordion'
export type {
  RvnAccordionProps,
  RvnAccordionItemProps,
  RvnAccordionHeaderProps,
  RvnAccordionPanelProps,
} from './RvnAccordion'

// Autocomplete / Combobox
export { RvnAutocomplete, RvnCombobox } from './RvnCombobox'
export type {
  RvnAutocompleteProps,
  RvnAutocompleteOption,
  RvnComboboxProps,
  RvnComboboxOption,
} from './RvnCombobox'

// Checkbox
export { RvnCheckbox } from './RvnCheckbox'
export type { RvnCheckboxProps } from './RvnCheckbox'

// Checkbox Group
export { RvnCheckboxGroup } from './RvnCheckboxGroup'
export type { RvnCheckboxGroupProps } from './RvnCheckboxGroup'

// Field
export { RvnField } from './RvnField'
export type { RvnFieldProps } from './RvnField'

// Fieldset
export { RvnFieldset } from './RvnFieldset'
export type { RvnFieldsetProps } from './RvnFieldset'

// Form
export { RvnForm } from './RvnForm'
export type { RvnFormProps } from './RvnForm'

// Input
export { RvnInput } from './RvnInput'
export type { RvnInputProps } from './RvnInput'

// Meter
export { RvnMeter } from './RvnMeter'
export type { RvnMeterProps } from './RvnMeter'

// Number Field
export { RvnNumberField } from './RvnNumberField'
export type { RvnNumberFieldProps } from './RvnNumberField'

// Radio
export { RvnRadio, RvnRadioGroup } from './RvnRadio'
export type { RvnRadioProps, RvnRadioGroupProps } from './RvnRadio'

// Select
export { RvnSelect } from './RvnSelect'
export type { RvnSelectProps, RvnSelectOption } from './RvnSelect'

// Slider
export { RvnSlider } from './RvnSlider'
export type { RvnSliderProps } from './RvnSlider'

// Switch
export { RvnSwitch } from './RvnSwitch'
export type { RvnSwitchProps } from './RvnSwitch'

// Toggle
export { RvnToggle } from './RvnToggle'
export type { RvnToggleProps } from './RvnToggle'

// Toggle Group
export { RvnToggleGroup, RvnToggleGroupItem } from './RvnToggleGroup'
export type { RvnToggleGroupProps, RvnToggleGroupItemProps } from './RvnToggleGroup'
