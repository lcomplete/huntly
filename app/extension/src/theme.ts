import { createTheme } from '@mui/material/styles';

// 生成唯一的类名前缀，确保在任何网页上都不会冲突
const HUNTLY_CLASS_PREFIX = `huntly-ext-${Date.now()}-`;

// 自定义类名生成函数 - 保留以备将来使用
// 注意：当前 MUI v5.11.14 使用 emotion 作为样式引擎，该函数暂时无法直接应用
// 如果升级到支持自定义类名生成器的版本，可以使用此函数
export const generateClassName = (rule: any, _sheet?: any) => {
  const prefix = HUNTLY_CLASS_PREFIX;
  return `${prefix}${rule.key}`;
};

// 创建简单的主题配置，只设置必要的 z-index 确保在任意网页上正确显示
export const huntlyTheme = createTheme({
  components: {
    MuiMenu: {
      styleOverrides: {
        paper: {
          zIndex: 99999,
        }
      }
    },
    MuiModal: {
      styleOverrides: {
        root: {
          zIndex: 99999,
        }
      }
    },
    MuiPopover: {
      styleOverrides: {
        root: {
          zIndex: 99999,
        }
      }
    }
  }
});