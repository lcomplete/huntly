import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, Paper, Tooltip, Fade } from '@mui/material';
import { alpha } from '@mui/material/styles';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { PageHighlightControllerApiFactory, PageHighlightDto } from '../../api';
import { useMutation } from '@tanstack/react-query';
import DeleteConfirmDialog from '../DeleteConfirmDialog';

interface TextHighlighterProps {
  pageId: number;
  content: string;
  highlights: PageHighlightDto[];
  onHighlightCreated?: (highlight: PageHighlightDto) => void;
  onHighlightDeleted?: (highlightId: number) => void;
  showSuccessMessage?: (message: string) => void;
  showErrorMessage?: (message: string) => void;
  highlightModeEnabled?: boolean;
}

interface SelectionTooltip {
  show: boolean;
  x: number;
  y: number;
  selectedText: string;
  startOffset: number;
  endOffset: number;
}

const TextHighlighter: React.FC<TextHighlighterProps> = ({
  pageId,
  content,
  highlights,
  onHighlightCreated,
  onHighlightDeleted,
  showSuccessMessage,
  showErrorMessage,
  highlightModeEnabled = true
}) => {
  const [selectionTooltip, setSelectionTooltip] = useState<SelectionTooltip>({
    show: false,
    x: 0,
    y: 0,
    selectedText: '',
    startOffset: 0,
    endOffset: 0
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [highlightToDelete, setHighlightToDelete] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 检查高亮重叠并合并的函数
  const checkAndMergeHighlights = (newStart: number, newEnd: number, newText: string) => {
    // 验证输入参数
    if (newStart >= newEnd || newStart < 0) {
      throw new Error('Invalid highlight range');
    }

    // 找出所有与新高亮有重叠的现有高亮
    const overlappingHighlights = highlights.filter(h => {
      if (h.startOffset == null || h.endOffset == null) return false;
      // 检查是否有重叠：新高亮的开始 < 现有高亮的结束 且 新高亮的结束 > 现有高亮的开始
      return newStart < h.endOffset && newEnd > h.startOffset;
    });

    if (overlappingHighlights.length === 0) {
      // 没有重叠，直接创建新高亮
      return {
        action: 'create' as const,
        startOffset: newStart,
        endOffset: newEnd,
        text: newText,
        toDelete: []
      };
    }

    // 计算合并后的范围
    const allHighlights = [...overlappingHighlights, { startOffset: newStart, endOffset: newEnd, highlightedText: newText }];
    const mergedStart = Math.min(...allHighlights.map(h => h.startOffset as number));
    const mergedEnd = Math.max(...allHighlights.map(h => h.endOffset as number));

    // 从原始内容中提取合并后的文本
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const plainText = tempDiv.textContent || '';

    // 验证合并范围是否有效
    if (mergedStart >= plainText.length || mergedEnd > plainText.length) {
      throw new Error('Merged highlight range exceeds content length');
    }

    const mergedText = plainText.slice(mergedStart, mergedEnd);

    return {
      action: 'merge' as const,
      startOffset: mergedStart,
      endOffset: mergedEnd,
      text: mergedText,
      toDelete: overlappingHighlights.filter(h => h.id != null).map(h => h.id as number)
    };
  };

  // 创建高亮的mutation
  const createHighlightMutation = useMutation({
    mutationFn: async (params: { text: string; startOffset: number; endOffset: number }) => {
      try {
        // 检查是否需要合并
        const mergeInfo = checkAndMergeHighlights(params.startOffset, params.endOffset, params.text);

        if (mergeInfo.action === 'merge' && mergeInfo.toDelete.length > 0) {
          // 先删除重叠的高亮
          await Promise.all(
            mergeInfo.toDelete.map(id =>
              PageHighlightControllerApiFactory().deleteHighlightUsingDELETE(id)
            )
          );
        }

        // 创建新的（可能是合并后的）高亮
        const response = await PageHighlightControllerApiFactory().createHighlightUsingPOST({
          pageId,
          highlightedText: mergeInfo.text,
          startOffset: mergeInfo.startOffset,
          endOffset: mergeInfo.endOffset
        });

        return {
          highlight: response.data.data,
          deletedIds: mergeInfo.toDelete,
          wasMerged: mergeInfo.action === 'merge'
        };
      } catch (error) {
        console.error('Error in highlight creation/merging:', error);
        throw error;
      }
    },
    onSuccess: (result) => {
      if (onHighlightCreated) {
        onHighlightCreated(result.highlight);
      }
      if (showSuccessMessage) {
        if (result.wasMerged && result.deletedIds.length > 0) {
          showSuccessMessage(`Highlight created and merged with ${result.deletedIds.length} existing highlight(s).`);
        } else {
          showSuccessMessage('Highlight created successfully.');
        }
      }
      setSelectionTooltip(prev => ({ ...prev, show: false }));
    },
    onError: (error) => {
      console.error('Failed to create/merge highlight:', error);
      if (showErrorMessage) {
        showErrorMessage('Failed to create highlight. Please try again.');
      }
    }
  });

  // 删除高亮的mutation
  const deleteHighlightMutation = useMutation({
    mutationFn: async (highlightId: number) => {
      await PageHighlightControllerApiFactory().deleteHighlightUsingDELETE(highlightId);
      return highlightId;
    },
    onSuccess: (highlightId) => {
      if (onHighlightDeleted) {
        onHighlightDeleted(highlightId);
      }
      if (showSuccessMessage) {
        showSuccessMessage('Highlight deleted.');
      }
      setDeleteDialogOpen(false);
      setHighlightToDelete(null);
    },
    onError: (error) => {
      console.error('Failed to delete highlight:', error);
      if (showErrorMessage) {
        showErrorMessage('Failed to delete highlight. Please try again.');
      }
      setDeleteDialogOpen(false);
      setHighlightToDelete(null);
    }
  });

  const handleDeleteConfirm = () => {
    if (highlightToDelete !== null) {
      deleteHighlightMutation.mutate(highlightToDelete);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setHighlightToDelete(null);
  };

  // 处理文本选择
  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current || !highlightModeEnabled) {
      setSelectionTooltip(prev => ({ ...prev, show: false }));
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setSelectionTooltip(prev => ({ ...prev, show: false }));
      return;
    }

    // 计算选择文本在内容中的偏移量
    const range = selection.getRangeAt(0);
    const startOffset = getTextOffset(contentRef.current, range.startContainer, range.startOffset);
    const endOffset = startOffset + selectedText.length;

    // 获取选择区域的位置
    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();

    setSelectionTooltip({
      show: true,
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top - 45,
      selectedText,
      startOffset,
      endOffset
    });
  }, []);

  // 获取文本在容器中的偏移量
  const getTextOffset = (container: Node, node: Node, offset: number): number => {
    let textOffset = 0;
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return textOffset + offset;
      }
      textOffset += currentNode.textContent?.length || 0;
    }
    return textOffset;
  };

  // 创建高亮
  const handleCreateHighlight = () => {
    createHighlightMutation.mutate({
      text: selectionTooltip.selectedText,
      startOffset: selectionTooltip.startOffset,
      endOffset: selectionTooltip.endOffset
    });
  };

  // 渲染带高亮的HTML内容
  const renderHighlightedContent = (htmlContent: string) => {
    if (!highlights.length) {
      return { __html: htmlContent };
    }

    // 创建临时DOM来处理HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // 获取纯文本内容用于偏移计算
    const plainText = tempDiv.textContent || '';
    
    // 为每个高亮创建标记
    const highlightMarkers: Array<{
      start: number;
      end: number;
      highlight: PageHighlightDto;
      id: string;
    }> = [];
    
    highlights.forEach((highlight) => {
      const startOffset = highlight.startOffset;
      const endOffset = highlight.endOffset;
      const highlightText = highlight.highlightedText;

      if (startOffset == null || endOffset == null || !highlightText) {
        return;
      }
      
      // 验证高亮文本是否在正确位置
      const textAtPosition = plainText.slice(startOffset, endOffset);

      // 规范化空白字符进行比较
      const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();
      const normalizedTextAtPosition = normalizeText(textAtPosition);
      const normalizedHighlightText = normalizeText(highlightText);

      if (textAtPosition === highlightText ||
          normalizedTextAtPosition === normalizedHighlightText ||
          textAtPosition.trim() === highlightText.trim()) {
        highlightMarkers.push({
          start: startOffset,
          end: endOffset,
          highlight,
          id: highlight.id != null ? `highlight-${highlight.id}` : `highlight-${startOffset}-${endOffset}`
        });
      } else {
        // 如果位置不匹配，尝试查找文本（模糊匹配）
        const trimmedText = highlightText.trim();
        let index = -1;

        // 首先尝试精确匹配
        index = plainText.indexOf(trimmedText);

        // 如果精确匹配失败，尝试规范化后的匹配
        if (index === -1) {
          const normalizedPlainText = normalizeText(plainText);
          const normalizedIndex = normalizedPlainText.indexOf(normalizedHighlightText);
          if (normalizedIndex !== -1) {
            // 需要将规范化文本中的索引转换回原文本中的索引
            let charCount = 0;
            let originalIndex = 0;
            for (let i = 0; i < plainText.length && charCount < normalizedIndex; i++) {
              if (!/\s/.test(plainText[i]) || (i > 0 && /\s/.test(plainText[i-1]) && !/\s/.test(plainText[i]))) {
                charCount++;
              }
              originalIndex = i + 1;
            }
            index = originalIndex;
          }
        }

        // 如果还是失败，尝试在预期位置附近查找
        if (index === -1) {
          const searchStart = Math.max(0, startOffset - 100);
          const searchEnd = Math.min(plainText.length, endOffset + 100);
          const searchArea = plainText.slice(searchStart, searchEnd);
          const localIndex = searchArea.indexOf(trimmedText);
          if (localIndex !== -1) {
            index = searchStart + localIndex;
          } else {
            // 在搜索区域内尝试规范化匹配
            const normalizedSearchArea = normalizeText(searchArea);
            const normalizedLocalIndex = normalizedSearchArea.indexOf(normalizedHighlightText);
            if (normalizedLocalIndex !== -1) {
              // 简化的索引转换，对于小范围搜索应该足够准确
              index = searchStart + Math.floor(normalizedLocalIndex * searchArea.length / normalizedSearchArea.length);
            }
          }
        }

        if (index !== -1) {
          // 使用实际找到的文本长度，而不是原始高亮文本长度
          const actualText = plainText.slice(index, index + trimmedText.length);
          let endIndex = index + trimmedText.length;

          // 如果长度不匹配，尝试调整结束位置
          if (normalizeText(actualText) !== normalizedHighlightText && index + highlightText.length <= plainText.length) {
            const extendedText = plainText.slice(index, index + highlightText.length);
            if (normalizeText(extendedText) === normalizedHighlightText) {
              endIndex = index + highlightText.length;
            }
          }

          highlightMarkers.push({
            start: index,
            end: endIndex,
            highlight,
            id: highlight.id != null ? `highlight-${highlight.id}` : `highlight-${index}-${endIndex}`
          });
        }
      }
    });
    
    // 按起始位置排序，从后往前处理
    highlightMarkers.sort((a, b) => b.start - a.start);
    
    // 应用高亮标记
    highlightMarkers.forEach((marker) => {
      applyHighlightToDOM(tempDiv, marker);
    });

    return { __html: tempDiv.innerHTML };
  };
  
  // 在DOM中应用高亮
  const applyHighlightToDOM = (container: Element, marker: any) => {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    const textNodes: Array<{ node: Text; start: number; end: number }> = [];

    // 收集所有文本节点及其位置信息
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const length = textNode.textContent?.length || 0;
      textNodes.push({
        node: textNode,
        start: currentOffset,
        end: currentOffset + length
      });
      currentOffset += length;
    }

    // 查找需要高亮的文本节点，按从后往前的顺序处理以避免DOM变化影响后续节点
    const targetNodes = textNodes
      .filter(item => item.start < marker.end && item.end > marker.start)
      .reverse();

    targetNodes.forEach(item => {
      const nodeStart = Math.max(0, marker.start - item.start);
      const nodeEnd = Math.min(item.node.textContent?.length || 0, marker.end - item.start);

      if (nodeStart < nodeEnd && item.node.textContent) {
        const beforeText = item.node.textContent.slice(0, nodeStart);
        const highlightText = item.node.textContent.slice(nodeStart, nodeEnd);
        const afterText = item.node.textContent.slice(nodeEnd);

        const parent = item.node.parentNode;
        if (parent) {
          const fragment = document.createDocumentFragment();

          if (beforeText) {
            fragment.appendChild(document.createTextNode(beforeText));
          }

          const highlightSpan = document.createElement('span');
          highlightSpan.className = 'highlight-text';
          if (marker.highlight.id != null) {
            highlightSpan.setAttribute('data-highlight-id', String(marker.highlight.id));
            // 添加群组标识，用于同一高亮的多个span
            highlightSpan.setAttribute('data-highlight-group', `group-${marker.highlight.id}`);
          }
          highlightSpan.setAttribute('title', 'Click to remove highlight');
          highlightSpan.textContent = highlightText;
          fragment.appendChild(highlightSpan);

          if (afterText) {
            fragment.appendChild(document.createTextNode(afterText));
          }

          parent.replaceChild(fragment, item.node);
        }
      }
    });
  };

  // 监听鼠标抬起事件
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(handleSelection, 10); // 小延迟确保选择完成
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (selectionTooltip.show && contentRef.current && !contentRef.current.contains(e.target as Node)) {
        setSelectionTooltip(prev => ({ ...prev, show: false }));
      }
    };

    const currentRef = contentRef.current;
    if (currentRef) {
      currentRef.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('mouseup', handleMouseUp);
      }
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleSelection, selectionTooltip.show, highlightModeEnabled]);

  // 处理高亮文本点击和hover事件
  useEffect(() => {
    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('highlight-text')) {
        e.preventDefault();
        e.stopPropagation();
        const highlightId = target.getAttribute('data-highlight-id');
        if (highlightId) {
          setHighlightToDelete(parseInt(highlightId));
          setDeleteDialogOpen(true);
        }
      }
    };

    const handleHighlightHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('highlight-text')) {
        const highlightGroup = target.getAttribute('data-highlight-group');
        if (highlightGroup && contentRef.current) {
          // 为同组的所有span添加hover样式
          const groupSpans = contentRef.current.querySelectorAll(`[data-highlight-group="${highlightGroup}"]`);
          groupSpans.forEach(span => {
            span.classList.add('highlight-group-hover');
          });
        }
      }
    };

    const handleHighlightLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('highlight-text')) {
        const highlightGroup = target.getAttribute('data-highlight-group');
        if (highlightGroup && contentRef.current) {
          // 移除同组的所有span的hover样式
          const groupSpans = contentRef.current.querySelectorAll(`[data-highlight-group="${highlightGroup}"]`);
          groupSpans.forEach(span => {
            span.classList.remove('highlight-group-hover');
          });
        }
      }
    };

    const currentRef = contentRef.current;
    if (currentRef) {
      currentRef.addEventListener('click', handleHighlightClick);
      currentRef.addEventListener('mouseover', handleHighlightHover);
      currentRef.addEventListener('mouseout', handleHighlightLeave);
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('click', handleHighlightClick);
        currentRef.removeEventListener('mouseover', handleHighlightHover);
        currentRef.removeEventListener('mouseout', handleHighlightLeave);
      }
    };
  }, [deleteHighlightMutation]);

  return (
    <Box
      position="relative"
      sx={{
        // Unified inline highlight style - matching globals.css
        '& .highlight-text': {
          backgroundColor: '#fff3e0 !important',
          cursor: 'pointer !important',
          borderRadius: '2px !important',
          // Support for cross-line highlighting
          boxDecorationBreak: 'clone !important',
          WebkitBoxDecorationBreak: 'clone !important',
          // Preserve original text properties
          lineHeight: 'inherit !important',
          fontSize: 'inherit !important',
          fontFamily: 'inherit !important',
          fontWeight: 'inherit !important',
          letterSpacing: 'inherit !important',
          wordSpacing: 'inherit !important',
          // Ensure no layout shifts
          margin: '0 !important',
          padding: '0 !important',
          border: 'none !important',
          // Smooth hover effect
          transition: 'background-color 0.2s ease !important',
        },
        '& .highlight-text:hover': {
          backgroundColor: '#ffe0b2 !important',
        },
        // 群组hover效果：当hover到一个高亮时，同组的所有高亮都显示hover效果
        '& .highlight-group-hover': {
          backgroundColor: '#ffe0b2 !important',
        },
        '& .highlight-flash': (theme) => ({
          outline: `2px solid ${alpha(theme.palette.warning.main, 0.8)}`,
          outlineOffset: '1px',
          backgroundColor: `${alpha(theme.palette.warning.main, theme.palette.mode === 'light' ? 0.42 : 0.5)} !important`,
        })
      }}
    >
      <div
        ref={contentRef}
        style={{
          userSelect: 'text',
          lineHeight: '1.6',
          fontSize: '16px'
        }}
        dangerouslySetInnerHTML={renderHighlightedContent(content)}
      />
      
      {/* 选择文本后的工具提示 */}
      {highlightModeEnabled && (
        <Fade in={selectionTooltip.show}>
          <Paper
            elevation={8}
            sx={{
              position: 'absolute',
              left: selectionTooltip.x,
              top: selectionTooltip.y,
              transform: 'translateX(-50%)',
              zIndex: 1000,
              p: 0.5,
              display: selectionTooltip.show ? 'block' : 'none'
            }}
          >
            <Tooltip title="Highlight selected text">
              <IconButton
                size="small"
                onClick={handleCreateHighlight}
                disabled={createHighlightMutation.isLoading}
                sx={{ color: (theme) => theme.palette.warning.main }}
              >
                <FormatQuoteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>
        </Fade>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        title="Are you sure you want to delete this highlight?"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Box>
  );
};

export default TextHighlighter;