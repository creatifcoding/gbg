/**
 * TaskItemView Component
 *
 * React node view for TaskItem in TipTap editor.
 * Wraps TaskCheckbox with proper node view integration.
 *
 * @module editor/v3/extensions/blocks/TaskItem/TaskItemView
 */

import { useCallback } from 'react';
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';

import { TaskCheckbox } from './TaskCheckbox';
import { taskItemStyle, taskItemCheckedContentStyle, contentStyle } from './styles';

// =============================================================================
// Component
// =============================================================================

export function TaskItemView({
  node,
  updateAttributes,
  editor,
}: NodeViewProps) {
  const checked = node.attrs.checked as boolean;

  const handleToggle = useCallback(
    (newChecked: boolean) => {
      updateAttributes({ checked: newChecked });
    },
    [updateAttributes]
  );

  return (
    <NodeViewWrapper
      as="li"
      style={taskItemStyle}
      data-type="taskItem"
      data-checked={checked}
    >
      <TaskCheckbox
        checked={checked}
        onToggle={handleToggle}
        disabled={!editor.isEditable}
      />
      <NodeViewContent
        as="div"
        className="task-item-content"
        style={{
          ...contentStyle,
          ...(checked ? taskItemCheckedContentStyle : {}),
        }}
      />
    </NodeViewWrapper>
  );
}

export default TaskItemView;
