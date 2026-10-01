import { useEffect, useRef } from 'react';

const RichTextEditor = ({ defaultValue, onChange }) => {
  const editorRef = useRef(null);

  // Set the content only on mount to prevent any cursor jumping/focus loss while typing
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = defaultValue || '';
    }
  }, []);

  const handleInput = () => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command, arg = null) => {
    // Focus the editor before executing command to ensure it operates on active selection
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, arg);
    handleInput();
  };

  const toolButton = (command, label, title) => (
    <button
      type="button"
      className="rte-btn"
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.preventDefault();
        executeCommand(command);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="rte">
      <div className="rte-toolbar">
        {toolButton('bold', <b>B</b>, 'მუქი')}
        {toolButton('italic', <i>I</i>, 'დახრილი')}
        {toolButton('underline', <u>U</u>, 'ხაზგასმული')}
        <span className="rte-sep" />
        {toolButton('insertUnorderedList', '•', 'სია')}
        {toolButton('insertOrderedList', '1.', 'დანომრილი სია')}
        <span className="rte-sep" />

        {/* Font Size Selector */}
        <select
          className="select"
          onChange={(e) => executeCommand('fontSize', e.target.value)}
          defaultValue="3"
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="ფონტის ზომა"
        >
          <option value="1">პატარა</option>
          <option value="3">საშუალო</option>
          <option value="5">დიდი</option>
          <option value="7">ძალიან დიდი</option>
        </select>

        {/* Color Picker */}
        <input
          type="color"
          className="rte-color"
          defaultValue="#000000"
          onChange={(e) => executeCommand('foreColor', e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="ტექსტის ფერი"
          title="ტექსტის ფერი"
        />
      </div>

      <div ref={editorRef} className="rte-content rich-text" contentEditable="true" onInput={handleInput} />
    </div>
  );
};

export default RichTextEditor;
