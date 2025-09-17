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
  showErrorMessage
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

  // 创建高亮的mutation
  const createHighlightMutation = useMutation({
    mutationFn: async (params: { text: string; startOffset: number; endOffset: number }) => {
      const response = await PageHighlightControllerApiFactory().createHighlightUsingPOST({
        pageId,
        highlightedText: params.text,
        startOffset: params.startOffset,
        endOffset: params.endOffset
      });
  return response.data.data;
    },
    onSuccess: (highlight) => {
      if (onHighlightCreated) {
        onHighlightCreated(highlight);
      }
      setSelectionTooltip(prev => ({ ...prev, show: false }));
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
    if (!selection || selection.isCollapsed || !contentRef.current) {
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
      y: rect.top - containerRect.top - 10,
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

    let currentNode;
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
      if (textAtPosition === highlightText || textAtPosition.trim() === highlightText.trim()) {
        highlightMarkers.push({
          start: startOffset,
          end: endOffset,
          highlight,
          id: highlight.id != null ? `highlight-${highlight.id}` : `highlight-${startOffset}-${endOffset}`
        });
      } else {
        // 如果位置不匹配，尝试查找文本（模糊匹配）
        const trimmedText = highlightText.trim();
        let index = plainText.indexOf(trimmedText);
        
        // 如果直接查找失败，尝试在预期位置附近查找
        if (index === -1) {
          const searchStart = Math.max(0, startOffset - 100);
          const searchEnd = Math.min(plainText.length, endOffset + 100);
          const searchArea = plainText.slice(searchStart, searchEnd);
          const localIndex = searchArea.indexOf(trimmedText);
          if (localIndex !== -1) {
            index = searchStart + localIndex;
          }
        }
        
        if (index !== -1) {
          highlightMarkers.push({
            start: index,
            end: index + trimmedText.length,
            highlight,
            id: highlight.id != null ? `highlight-${highlight.id}` : `highlight-${index}-${index + trimmedText.length}`
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
    let node;
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
  }, [handleSelection, selectionTooltip.show]);

  // 处理高亮文本点击事件
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

    const currentRef = contentRef.current;
    if (currentRef) {
      currentRef.addEventListener('click', handleHighlightClick);
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('click', handleHighlightClick);
      }
    };
  }, [deleteHighlightMutation]);

  return (
    <Box
      position="relative"
      sx={{
        // Unified inline highlight style
        '& .highlight-text': (theme) => ({
          backgroundColor: alpha(theme.palette.warning.main, theme.palette.mode === 'light' ? 0.28 : 0.36),
          color: 'inherit',
          borderRadius: '3px',
          padding: '0.05em 0.2em',
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
          transition: 'background-color 120ms ease',
        }),
        '& .highlight-text:hover': (theme) => ({
          backgroundColor: alpha(theme.palette.warning.main, theme.palette.mode === 'light' ? 0.34 : 0.42),
        }),
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