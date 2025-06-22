import React, { useState, useEffect } from "react";
import styles from './article.module.css';
import Modal from 'react-modal';
import { CircularProgress, Button, Divider, Typography } from "@mui/material";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Article({page}: { page: PageModel }) {
  const [open, setOpen] = React.useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedContent, setProcessedContent] = useState("");
  const [processedTitle, setProcessedTitle] = useState("");
  const [showProcessedSection, setShowProcessedSection] = useState(false);

  function handleClose(e) {
    document.getElementById("huntly_preview_unique_root").removeAttribute("data-preview");
    // 发送取消处理的消息
    if (isProcessing) {
      chrome.runtime.sendMessage({
        type: 'cancel_processing'
      });
    }
    setOpen(false);
  }
  
  useEffect(() => {
    // 监听来自popup的消息
    const messageListener = (msg: any, sender, sendResponse) => {
      if (msg.type === 'process_result') {
        setProcessedContent(msg.payload.content);
        setProcessedTitle(msg.payload.title);
        setShowProcessedSection(true);
        setIsProcessing(false);
      } else if (msg.type === 'processing_start') {
        setIsProcessing(true);
        setShowProcessedSection(true);
        setProcessedTitle(msg.payload?.title || "处理中...");
        setProcessedContent("");
      } else if (msg.type === 'process_data') {
        // 处理流式数据
        setProcessedContent(msg.payload.accumulatedContent);
        setProcessedTitle(msg.payload.title);
        setShowProcessedSection(true);
        setIsProcessing(true); // 仍在处理中
      } else if (msg.type === 'process_error') {
        // 处理错误
        setProcessedContent(`处理失败: ${msg.payload.error}`);
        setProcessedTitle(msg.payload.title);
        setShowProcessedSection(true);
        setIsProcessing(false);
      }
    };
    
    // 添加消息监听器
    chrome.runtime.onMessage.addListener(messageListener);
    
    // 清理函数
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      // 组件卸载时如果还在处理中，发送取消消息
      if (isProcessing) {
        chrome.runtime.sendMessage({
          type: 'cancel_processing'
        });
      }
    };
  }, [isProcessing]);
  
  Modal.setAppElement("#huntly_preview_unique_root");

  return (
    <React.Fragment>
      {
        open &&
        <Modal isOpen={open} onRequestClose={handleClose} style={{
          overlay: {
            zIndex: 999999,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.85)'
          },
          content: {
            overflow: 'auto',
            width: '90%',
            maxWidth: '1700px', // 增加最大宽度以容纳两个840px区域
            boxShadow: 'rgba(0, 0, 0, 0.2) 0px 3px 5px -1px, rgba(0, 0, 0, 0.14) 0px 6px 10px 0px, rgba(0, 0, 0, 0.12) 0px 1px 18px 0px',
            padding: '20px',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            height: '95%',
            boxSizing: 'border-box',
            transform: 'translate(-50%, -50%)',
          }
        }}>
          <div className={styles.articleWrapper} style={{ 
            display: 'flex', 
            height: '100%',
            justifyContent: 'center', // 居中显示
            gap: '20px' // 两栏之间的间距
          }}>
            {/* 文章内容区域 */}
            <div className={styles.article} style={{ 
              width: '840px', 
              maxWidth: '100%',
              flexShrink: 1,
              overflow: 'auto'
            }}>
              <article className={styles["markdown-body"]}>
                <h1 style={{marginBottom: 2}}>
                  {page.title}
                </h1>

                <div>
                  <div dangerouslySetInnerHTML={{__html: page.content}}></div>
                </div>
              </article>
            </div>
            
            {/* 右侧边栏 - 只在有处理结果时显示 */}
            {showProcessedSection && (
              <div style={{ 
                width: '840px',
                maxWidth: '100%',
                flexShrink: 1,
                borderLeft: '1px solid #eee', 
                paddingLeft: '20px',
                overflow: 'auto'
              }}>
                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '10px'
                  }}>
                    <Typography variant="h6" style={{ fontSize: '16px' }}>
                      {processedTitle}
                    </Typography>
                    {isProcessing && <CircularProgress size={18} />}
                  </div>
                  <Divider style={{ marginBottom: '10px' }} />
                  
                  {isProcessing && !processedContent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '60px', marginTop: '20px' }}>
                      <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '100%' }}></div>
                      <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '80%' }}></div>
                      <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', width: '60%' }}></div>
                    </div>
                  ) : (
                    <div className={styles["markdown-body"]}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                      >
                        {processedContent}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      }
    </React.Fragment>
  )
}