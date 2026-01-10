import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import {NavLink} from "react-router-dom";
import * as React from "react";
import TreeItem, {treeItemClasses, TreeItemProps} from "@mui/lab/TreeItem";
import {SvgIconProps} from "@mui/material/SvgIcon";
import {styled} from "@mui/material/styles";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TreeView from "@mui/lab/TreeView";
import ConditionalWrapper from "../common/ConditionalWrapper";
import {NavLabel} from "./NavLabels";

declare module 'react' {
  interface CSSProperties {
    '--tree-view-color'?: string;
    '--tree-view-bg-color'?: string;
  }
}

type StyledTreeItemProps = TreeItemProps & {
  bgColor?: string;
  color?: string;
  iconColor?: string;
  labelIcon: React.ElementType<SvgIconProps>;
  iconUrl?: string,
  labelInfo?: string;
  labelText: string;
  linkTo?: string;
  emphasizeCounts?: boolean;
};

const StyledTreeItemRoot = styled(TreeItem)(({theme}) => ({
  color: '#64748b',
  [`& .${treeItemClasses.content}`]: {
    color: 'inherit',
    borderRadius: '6px',
    paddingTop: theme.spacing(0.25),
    paddingBottom: theme.spacing(0.25),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1.5),
    marginTop: theme.spacing(0.25),
    marginBottom: theme.spacing(0.25),
    fontWeight: theme.typography.fontWeightMedium,
    transition: 'background-color 0.15s ease, color 0.15s ease',
    '&.Mui-expanded': {
      fontWeight: theme.typography.fontWeightRegular,
    },
    '&:hover': {
      backgroundColor: 'rgba(59, 130, 246, 0.06)',
      color: '#475569',
    },
    '&.Mui-focused, &.Mui-selected, &.Mui-selected.Mui-focused': {
      backgroundColor: 'rgba(59, 130, 246, 0.10)',
      color: '#2563eb',
      fontWeight: 600,
      [`& .${treeItemClasses.iconContainer}`]: {
        color: '#3b82f6',
      },
    },
    [`& .${treeItemClasses.label}`]: {
      fontWeight: 'inherit',
      color: 'inherit',
      paddingLeft: 0,
    },
    [`& .${treeItemClasses.iconContainer}`]: {
      marginRight: theme.spacing(0.5),
      width: 20,
      color: '#94a3b8',
      '& svg': {
        fontSize: 18,
      },
    },
  },

  [`& .${treeItemClasses.group}`]: {
    marginLeft: theme.spacing(2),
    [`& .${treeItemClasses.content}`]: {
      paddingLeft: theme.spacing(1),
    },
  },

  // NavLink 样式重置
  '& a': {
    color: 'inherit',
    textDecoration: 'none',
    display: 'block',
  },
}));

function StyledTreeItem(props: StyledTreeItemProps) {
  const {
    bgColor,
    color,
    labelIcon: LabelIcon,
    labelInfo,
  labelText,
  iconColor,
  iconUrl,
  linkTo,
  emphasizeCounts,
  ...other
  } = props;

  return (
    <StyledTreeItemRoot
      label={
        <ConditionalWrapper condition={linkTo}
                            wrapper={children => <NavLink to={linkTo}>{children}</NavLink>}>
          <Box sx={{display: 'flex', alignItems: 'center', py: 0.375, pr: 0, pl: 0, minHeight: 28}}>
            {
              iconUrl && <Box component={'img'}
                              sx={{mr: 0.875, width: 18, height: 18, opacity: 0.8, flexShrink: 0}} src={iconUrl}/>
            }
            {
              !iconUrl && <Box component={LabelIcon} sx={{mr: 0.875, fontSize: 18, color: iconColor || '#64748b', flexShrink: 0}}/>
            }
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'inherit',
                flexGrow: 1,
                fontSize: '13.5px',
                lineHeight: 1.4,
                color: 'inherit',
              }}
              className={'whitespace-nowrap overflow-hidden overflow-ellipsis'}
            >
              {labelText}
            </Typography>
            {labelInfo && (
              <Typography
                variant="caption"
                sx={{
                  color: emphasizeCounts ? '#64748b' : '#94a3b8',
                  fontSize: emphasizeCounts ? '11.5px' : '11px',
                  fontWeight: emphasizeCounts ? 600 : 500,
                  ml: 0.75,
                  flexShrink: 0,
                }}
              >
                {labelInfo}
              </Typography>
            )}
          </Box>
        </ConditionalWrapper>
      }
      style={{
        '--tree-view-color': color || '#2563eb',
        '--tree-view-bg-color': bgColor || 'rgba(59, 130, 246, 0.10)',
      }}
      {...other}
    />
  );
}

export interface NavTreeViewItem extends NavLabel {
  inboxCount?: number,
  childItems?: NavTreeViewItem[],
}

export default function NavTreeView({
                                      treeItems,
                                      ariaLabel,
                                      defaultExpanded,
                                      selectedNodeId,
                                      emphasizeCounts = false,
                                    }: { treeItems: NavTreeViewItem[], ariaLabel: string, defaultExpanded: string[], selectedNodeId: string, emphasizeCounts?: boolean }) {
  function itemView(item: NavTreeViewItem, parentNodeId: string, index: number) {
    const nodeId = item.linkTo || (parentNodeId ? parentNodeId + "_" + index.toString() : index.toString());
    return (<React.Fragment key={nodeId}>
      {
        <StyledTreeItem nodeId={nodeId} labelIcon={item.labelIcon} iconColor={item.iconColor} iconUrl={item.iconUrl}
                        labelText={item.labelText} labelInfo={item.inboxCount > 0 ? item.inboxCount.toString() : ""}
                        linkTo={item.linkTo}
                        emphasizeCounts={emphasizeCounts}
        >
          {item.childItems && item.childItems.map((child, i) => itemView(child, nodeId, i))}
        </StyledTreeItem>
      }
    </React.Fragment>)
  }

  return (
    <TreeView
      aria-label={ariaLabel}
      defaultExpanded={defaultExpanded}
      defaultCollapseIcon={<ArrowDropDownIcon sx={{ color: '#94a3b8', fontSize: 18 }}/>}
      defaultExpandIcon={<ArrowRightIcon sx={{ color: '#94a3b8', fontSize: 18 }}/>}
      defaultEndIcon={<div style={{width: 18}}/>}
      selected={selectedNodeId}
      sx={{flexGrow: 1, overflowY: 'auto', px: 0, pt: 0.25, pb: 0.25}}
    >
      {
        treeItems.map((item, i) => itemView(item, "", i))
      }
    </TreeView>
  );
}
