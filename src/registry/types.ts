export type RegistryItemType =
  "hyperframes:block" | "hyperframes:component" | "hyperframes:example";

export interface RegistryVariableOption {
  value: string;
  label: string;
}

export interface RegistryVariable {
  id: string;
  type: "string" | "number" | "boolean" | "color" | "enum" | "image" | "audio";
  role?: "content" | "style" | "timing";
  label?: string;
  description?: string;
  default?: string | number | boolean;
  options?: readonly RegistryVariableOption[];
  portrays?: readonly string[];
}

export interface RegistryDimensions {
  width: number;
  height: number;
}

export interface RegistryItemFile {
  path: string;
  target?: string;
  type?: string;
}

export interface RegistryItemSummary {
  name: string;
  type: RegistryItemType;
  title?: string;
  description?: string;
  tags?: readonly string[];
  jobs?: readonly string[];
  author?: string;
  dimensions?: RegistryDimensions;
  duration?: number;
  family?: string;
  profile?: string;
  variables?: readonly RegistryVariable[];
  files?: readonly RegistryItemFile[];
}

export interface RegistryManifest {
  $schema?: string;
  name: string;
  homepage?: string;
  items: readonly RegistryItemSummary[];
}
