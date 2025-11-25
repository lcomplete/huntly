import React, { useEffect, useState, useCallback } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  containerSelector?: string;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ 
  content, 
  containerSelector = '.page-content' 
}) => {
  const [activeId, setActiveId] = useState<string>('');
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  // 从内容中提取标题
  const extractHeadings = useCallback((htmlContent: string): TocItem[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    const items: TocItem[] = [];
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      const text = heading.textContent?.trim() || '';
      if (text) {
        // 生成唯一 ID
        const id = `toc-heading-${index}`;
        items.push({ id, text, level });
      }
    });
    
    return items;
  }, []);

  // 初始化时提取标题
  useEffect(() => {
    const items = extractHeadings(content);
    setTocItems(items);
  }, [content, extractHeadings]);

  // 为实际 DOM 中的标题元素添加 ID
  useEffect(() => {
    if (tocItems.length === 0) return;
    
    // 等待 DOM 渲染完成
    const timer = setTimeout(() => {
      const container = document.querySelector(containerSelector);
      if (!container) return;
      
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((heading, index) => {
        if (index < tocItems.length) {
          heading.id = tocItems[index].id;
        }
      });
    }, 100);
    
    return () => clearTimeout(timer);
  }, [tocItems, containerSelector]);

  // 监听滚动事件，更新当前激活的标题
  useEffect(() => {
    if (tocItems.length === 0) return;

    const handleScroll = () => {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      
      // 找到当前视口中最近的标题
      let currentActive = '';
      const offset = 120; // 固定偏移量，考虑顶部固定头部

      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i] as HTMLElement;
        const rect = heading.getBoundingClientRect();
        
        if (rect.top <= offset) {
          currentActive = heading.id;
          break;
        }
      }

      // 如果没有找到（在页面最顶部），激活第一个标题
      if (!currentActive && headings.length > 0) {
        const firstHeading = headings[0] as HTMLElement;
        const rect = firstHeading.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          currentActive = firstHeading.id;
        }
      }

      if (currentActive !== activeId) {
        setActiveId(currentActive);
      }
    };

    // 延迟初始调用确保 DOM 已渲染
    const initTimer = setTimeout(() => {
      handleScroll();
    }, 200);

    // 监听页面滚动
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 监听 drawer 内的滚动（如果在 modal 中）
    const drawer = document.querySelector('.MuiDrawer-paper');
    if (drawer) {
      drawer.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('scroll', handleScroll);
      if (drawer) {
        drawer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [tocItems, activeId, containerSelector]);

  // 点击目录项滚动到对应位置
  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      // 获取 drawer 容器
      const drawer = document.querySelector('.MuiDrawer-paper');
      const offsetTop = 80; // 顶部固定栏的高度偏移
      
      if (drawer) {
        const elementTop = element.getBoundingClientRect().top + drawer.scrollTop - drawer.getBoundingClientRect().top;
        drawer.scrollTo({
          top: elementTop - offsetTop,
          behavior: 'smooth'
        });
      } else {
        const elementTop = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: elementTop - offsetTop,
          behavior: 'smooth'
        });
      }
      setActiveId(id);
    }
  };

  // 如果标题数量少于等于 2 个，不显示目录
  if (tocItems.length <= 2) {
    return null;
  }

  // 计算最小层级，用于调整缩进
  const minLevel = Math.min(...tocItems.map(item => item.level));

  return (
    <div className="toc-wrapper">
      <nav className="toc-nav">
        <ul className="toc-list">
          {tocItems.map((item) => {
            const indent = (item.level - minLevel) * 14;
            const isActive = activeId === item.id;
            
            return (
              <li 
                key={item.id}
                style={{ paddingLeft: `${indent}px` }}
                className="toc-item"
              >
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  className={`toc-link ${isActive ? 'toc-link-active' : ''}`}
                  title={item.text}
                >
                  <span className="line-clamp-2">
                    {item.text}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default TableOfContents;
