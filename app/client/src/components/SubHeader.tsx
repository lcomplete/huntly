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
  navLabelArea?: ReactElement
}

const SubHeader = (props: SubHeaderProps) => {
  const {
    navLabel,
    navLabelArea,
    onMarkListAsRead,
    onMarkAllAsRead
  } = props;
  const defaultBtnOptions: ButtonOptions = {markRead: true, viewSwitch: false};
  const buttonOptions = {...defaultBtnOptions, ...props.buttonOptions};

  const hasButtons = buttonOptions.markRead || buttonOptions.viewSwitch;

  return <div className={'subheader w-full'}>
    <div className={'subheader-bar'}>
      <div className={'subheader-left'}>
        <div className={'subheader-title'}>
          {
            navLabel.iconUrl ? <Box component={'img'}
                           sx={{mr: 1, width: 24, height: 24}} src={navLabel.iconUrl}/>
              : <SvgIcon component={navLabel.labelIcon} sx={{color: navLabel.iconColor}}/>
          }
          <span className={'subheader-label'}>{navLabel.labelText}</span>
          {navLabelArea}
        </div>

        {hasButtons && (
          <div className={'subheader-actions subheader-actions-left'}>
            {
              buttonOptions.markRead && <div className={'subheader-action-group group'}>
                    <Tooltip title={'Mark list as read'} placement={"bottom"}>
                        <IconButton size="small" className={'subheader-action'} onClick={onMarkListAsRead}>
                            <CheckIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                    <div className={"subheader-action-stack group-hover:flex hidden absolute flex-col"}>
                        <Tooltip title={'Mark all as read'} placement={"bottom"}>
                            <IconButton size="small" className={'subheader-action'} onClick={onMarkAllAsRead}>
                                <DoneAllIcon fontSize="small"/>
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>
            }

            {
              buttonOptions.viewSwitch && <div className={'subheader-action-group group'}>
                    <Tooltip title={'Magazine view'} placement={"bottom"}>
                        <IconButton size="small" className={'subheader-action'}>
                            <ListAltIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                    <div className={"subheader-action-stack group-hover:flex hidden absolute flex-col"}>
                        <Tooltip title={'Column view'} placement={"bottom"}>
                            <IconButton size="small" className={'subheader-action'}>
                                <VerticalSplitOutlinedIcon fontSize="small"/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={'List view'} placement={"bottom"}>
                            <IconButton size="small" className={'subheader-action'}>
                                <ViewHeadlineOutlinedIcon fontSize="small"/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={'Expanded view'} placement={"bottom"}>
                            <IconButton size="small" className={'subheader-action'}>
                                <ViewDayOutlinedIcon fontSize="small"/>
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>
            }
          </div>
        )}
      </div>

      <div className={'subheader-right'}>
        <div className={'subheader-search'}>
          <SearchBox />
        </div>
      </div>
    </div>
  </div>
}

export default SubHeader;
