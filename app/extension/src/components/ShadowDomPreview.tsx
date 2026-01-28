import React, { useEffect, useRef, createContext, useContext } from "react";
import { createRoot, Root } from "react-dom/client";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { getShadowDomStyles } from "../styles/shadowDomStyles";
import { ArticlePreview } from "./ArticlePreview";
import { ContentParserType } from "../storage";
import { ExternalShortcutsData, ExternalModelsData, ShortcutItem, ModelItem } from "./AIToolbar";

interface ShadowDomPreviewProps {
  page: PageModel;
  initialParserType: ContentParserType;
  onClose: () => void;
  onParserChange?: (parserType: ContentParserType, newPage: PageModel) => void;
  /** Externally provided shortcuts data (for content script use) */
  externalShortcuts?: ExternalShortcutsData;
  /** Externally provided models data (for content script use) */
  externalModels?: ExternalModelsData;
  /** Shortcut to auto-execute on mount */
  autoExecuteShortcut?: ShortcutItem;
  /** Model to use for auto-execute */
  autoSelectedModel?: ModelItem | null;
}

// Context for Shadow DOM container (used by MUI Menu components)
export const ShadowContainerContext = createContext<HTMLElement | null>(null);

// Hook to get the shadow container
export const useShadowContainer = () => useContext(ShadowContainerContext);

interface ShadowContentProps {
  emotionCache: ReturnType<typeof createCache>;
  container: HTMLElement;
  children: React.ReactNode;
}

// Wrapper component that provides Emotion cache and MUI theme
const ShadowContent: React.FC<ShadowContentProps> = ({ emotionCache, container, children }) => {
  const getContainer = React.useCallback(() => container, [container]);

  // Create theme with container pointing to shadow root
  const theme = React.useMemo(() => createTheme({
    components: {
      MuiPopover: {
        defaultProps: {
          container: getContainer,
        },
      },
      MuiPopper: {
        defaultProps: {
          container: getContainer,
        },
      },
      MuiModal: {
        defaultProps: {
          container: getContainer,
        },
      },
      MuiMenu: {
        defaultProps: {
          PopoverClasses: {},
        },
        styleOverrides: {
          paper: {
            // Ensure menu paper has proper z-index in shadow DOM
            zIndex: 99999,
          },
        },
      },
    },
  }), [getContainer]);

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <ShadowContainerContext.Provider value={container}>
          {children}
        </ShadowContainerContext.Provider>
      </ThemeProvider>
    </CacheProvider>
  );
};

export const ShadowDomPreview: React.FC<ShadowDomPreviewProps> = (props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root | null>(null);
  const emotionCacheRef = useRef<ReturnType<typeof createCache> | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    // Create shadow root
    const shadowRoot = hostRef.current.attachShadow({ mode: "open" });

    // Inject styles into shadow DOM
    const styleElement = document.createElement("style");
    styleElement.textContent = getShadowDomStyles();
    shadowRoot.appendChild(styleElement);

    // Create a container for Emotion styles
    const emotionStyleContainer = document.createElement("div");
    emotionStyleContainer.id = "huntly-emotion-styles";
    shadowRoot.appendChild(emotionStyleContainer);

    // Create Emotion cache that injects styles into shadow DOM
    emotionCacheRef.current = createCache({
      key: "huntly-mui",
      container: emotionStyleContainer,
      prepend: true,
    });

    // Create container for React content
    const container = document.createElement("div");
    container.id = "huntly-shadow-content";
    container.style.cssText = `
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483647;
      pointer-events: auto;
    `;
    shadowRoot.appendChild(container);
    containerRef.current = container;

    // Create a new React root inside the Shadow DOM
    // This ensures React's event delegation works correctly within the Shadow DOM boundary
    rootRef.current = createRoot(container);
    rootRef.current.render(
      <ShadowContent emotionCache={emotionCacheRef.current} container={container}>
        <ArticlePreview {...props} />
      </ShadowContent>
    );

    // Cleanup
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update the rendered content when props change
  useEffect(() => {
    // Skip if not initialized yet
    if (!rootRef.current || !emotionCacheRef.current || !containerRef.current) return;

    rootRef.current.render(
      <ShadowContent emotionCache={emotionCacheRef.current} container={containerRef.current}>
        <ArticlePreview {...props} />
      </ShadowContent>
    );
  }, [props]);

  return <div ref={hostRef} style={{ display: "contents" }} />;
};

export default ShadowDomPreview;

