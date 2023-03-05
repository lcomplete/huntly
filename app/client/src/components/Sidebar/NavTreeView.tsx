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
};

const StyledTreeItemRoot = styled(TreeItem)(({theme}) => ({
  color: theme.palette.text.primary,
  [`& .${treeItemClasses.content}`]: {
    color: theme.palette.text.primary,
    borderTopRightRadius: theme.spacing(2),
    borderBottomRightRadius: theme.spacing(2),
    paddingRight: theme.spacing(1),
    fontWeight: theme.typography.fontWeightMedium,
    '&.Mui-expanded': {
      fontWeight: theme.typography.fontWeightRegular,
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-focused, &.Mui-selected, &.Mui-selected.Mui-focused': {
      backgroundColor: `var(--tree-view-bg-color, ${theme.palette.action.selected})`,
      color: 'var(--tree-view-color)',
      fontWeight: theme.typography.fontWeightBold,
    },
    [`& .${treeItemClasses.label}`]: {
      fontWeight: 'inherit',
      color: 'inherit',
      paddingLeft: 0
    },
    [`& .${treeItemClasses.iconContainer}`]: {
      marginRight: 0,
    },
    [`& .${treeItemClasses.root}`]: {
      paddingLeft: 0,
    },
  },

  [`& .${treeItemClasses.group}`]: {
    marginLeft: 0,
    [`& .${treeItemClasses.content}`]: {
      paddingLeft: theme.spacing(2),
    },
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
    ...other
  } = props;

  return (
    <StyledTreeItemRoot
      label={
        <ConditionalWrapper condition={linkTo}
                            wrapper={children => <NavLink to={linkTo}>{children}</NavLink>}>
          <Box sx={{display: 'flex', alignItems: 'center', p: 0.5, pr: 0, pl: 0}}>

            {
              iconUrl && <Box component={'img'}
                              color={iconColor || 'inherit'} sx={{mr: 1, width: 24, height: 24}} src={iconUrl}/>
            }
            {
              !iconUrl && <Box component={LabelIcon} color={iconColor || 'inherit'} sx={{mr: 1}}/>
            }
            <Typography variant="body2" sx={{fontWeight: 'inherit', flexGrow: 1}}
                        className={'whitespace-nowrap overflow-hidden overflow-ellipsis'}>
              {labelText}
            </Typography>
            <Typography variant="caption" color="inherit" className={'leading-4'}>
              {labelInfo}
            </Typography>
          </Box>
        </ConditionalWrapper>
      }
      style={{
        '--tree-view-color': color || '#202124',
        '--tree-view-bg-color': bgColor || '#d3e3fd',
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
                                      selectedNodeId
                                    }: { treeItems: NavTreeViewItem[], ariaLabel: string, defaultExpanded: string[], selectedNodeId: string }) {
  function itemView(item: NavTreeViewItem, parentNodeId: string, index: number) {
    const nodeId = item.linkTo || (parentNodeId ? parentNodeId + "_" + index.toString() : index.toString());
    return (<React.Fragment key={nodeId}>
      {
        <StyledTreeItem nodeId={nodeId} labelIcon={item.labelIcon} iconColor={item.iconColor} iconUrl={item.iconUrl}
                        labelText={item.labelText} labelInfo={item.inboxCount > 0 ? item.inboxCount.toString() : ""}
                        linkTo={item.linkTo}
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
      defaultCollapseIcon={<ArrowDropDownIcon/>}
      defaultExpandIcon={<ArrowRightIcon/>}
      defaultEndIcon={<div style={{width: 24}}/>}
      selected={selectedNodeId}
      sx={{flexGrow: 1, overflowY: 'auto'}}
    >
      {
        treeItems.map((item, i) => itemView(item, "", i))
      }
    </TreeView>
  );
}