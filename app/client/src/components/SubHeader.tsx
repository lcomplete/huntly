import {Box, IconButton, SvgIcon, Tooltip} from "@mui/material";
import "./SubHeader.css";
import * as React from "react";
import {ReactElement} from "react";
import {NavLabel} from "./Sidebar/NavLabels";
import SearchBox from "./SearchBox";
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ViewHeadlineOutlinedIcon from '@mui/icons-material/ViewHeadlineOutlined';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';
import ViewDayOutlinedIcon from '@mui/icons-material/ViewDayOutlined';


export type ButtonOptions = {
  markRead?: boolean,
  viewSwitch?: boolean
}

type SubHeaderProps = {
  navLabel: NavLabel,
  onMarkListAsRead?: () => void,
  onMarkAllAsRead?: () => void,
  buttonOptions?: ButtonOptions,
  navLabelArea?: ReactElement,
  rightContent?: ReactElement,
  hideSearchOnMobile?: boolean
}

const SubHeader = (props: SubHeaderProps) => {
  const {
    navLabel,
    navLabelArea,
    onMarkListAsRead,
    onMarkAllAsRead,
    rightContent,
    hideSearchOnMobile = true
  } = props;
  const defaultBtnOptions: ButtonOptions = {markRead: true, viewSwitch: false};
  const buttonOptions = {...defaultBtnOptions, ...props.buttonOptions};

  const viewOptions = [
    {id: 'magazine', label: 'Magazine view', icon: ListAltIcon},
    {id: 'column', label: 'Column view', icon: VerticalSplitOutlinedIcon},
    {id: 'list', label: 'List view', icon: ViewHeadlineOutlinedIcon},
    {id: 'expanded', label: 'Expanded view', icon: ViewDayOutlinedIcon}
  ] as const;

  const [viewMode, setViewMode] = React.useState<typeof viewOptions[number]['id']>('magazine');
  const activeView = viewOptions.find((option) => option.id === viewMode) ?? viewOptions[0];
  const ActiveViewIcon = activeView.icon;

  const hasButtons = buttonOptions.markRead || buttonOptions.viewSwitch;
  const hasRightContent = Boolean(rightContent);

  return <div className={'subheader w-full'}>
    <div className={'subheader-bar'}>
      <div className={'subheader-left'}>
        <div className={'subheader-title'}>
          {
            navLabel.iconUrl ? <Box component={'img'}
                           sx={{mr: 1, width: 24, height: 24}} src={navLabel.iconUrl}/>
              : <SvgIcon component={navLabel.labelIcon} sx={{color: navLabel.iconColor}}/>
          }
          {navLabel.showLabel !== false && <span className={'subheader-label'}>{navLabel.labelText}</span>}
          {navLabelArea}
        </div>

        {hasButtons && (
          <div className={'subheader-actions subheader-actions-left'}>
            {
              buttonOptions.markRead && <div className={'group relative'}>
                  <Tooltip title={'Mark list as read'} placement={"right"} disableInteractive>
                      <IconButton className={'group-hover:shadow-heavy group-hover:bg-white'} onClick={onMarkListAsRead}>
                          <CheckIcon fontSize="small"/>
                      </IconButton>
                  </Tooltip>
                  <div className={'group-hover:flex hidden absolute flex-col z-40'}>
                      <Tooltip title={'Mark all as read'} placement={"right"} disableInteractive>
                          <IconButton className={'mt-2 bg-white shadow-heavy hover:bg-white'} onClick={onMarkAllAsRead}>
                              <DoneAllIcon fontSize="small"/>
                          </IconButton>
                      </Tooltip>
                  </div>
                </div>
            }

            {
              buttonOptions.viewSwitch && <div className={'subheader-action-group group'}>
                    <Tooltip title={activeView.label} placement={"bottom"}>
                        <IconButton size="small" className={'subheader-action subheader-action-active'}>
                            <ActiveViewIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                    <div className={"subheader-action-stack subheader-action-menu group-hover:flex hidden absolute"}>
                        {viewOptions.map((option) => {
                          const OptionIcon = option.icon;
                          return (
                            <Tooltip title={option.label} placement={"bottom"} key={option.id}>
                                <IconButton
                                  size="small"
                                  className={`subheader-action subheader-action-option ${option.id === viewMode ? 'subheader-action-active' : ''}`}
                                  onClick={() => setViewMode(option.id)}
                                >
                                    <OptionIcon fontSize="small"/>
                                </IconButton>
                            </Tooltip>
                          );
                        })}
                    </div>
                </div>
            }
          </div>
        )}
      </div>

      {hasRightContent && (
        <div className={'subheader-middle'}>
          <div className={'subheader-right-content'}>
            {rightContent}
          </div>
        </div>
      )}
      <div className={`subheader-right ${hideSearchOnMobile ? 'subheader-right-hide-mobile' : ''}`}>
        <div className={`subheader-search ${hasRightContent ? 'subheader-search-separated' : ''}`}>
          <SearchBox />
        </div>
      </div>
    </div>
  </div>
}

export default SubHeader;
