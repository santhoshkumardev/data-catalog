import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";

interface Props {
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  minHeight?: string;
}

export default function SqlEditor({ value, onChange, readOnly, minHeight = "120px" }: Props) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      extensions={[sql()]}
      theme={oneDark}
      basicSetup={{ lineNumbers: true, autocompletion: true }}
      style={{ minHeight }}
    />
  );
}
