import {Box, IconButton, SvgIcon, Tooltip} from "@mui/material";
import "./SubHeader.css";
import * as React from "react";
import {ReactElement} from "react";
import {NavLabel} from "./Sidebar/NavLabels";
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
    <div className={'flex items-center border-b-gray-500 pl-3 pr-3 pt-1 pb-1 min-h-[48px]'}>
      <div className={'flex items-center'}>
        {
          navLabel.iconUrl ? <Box component={'img'}
                         sx={{mr: 1, width: 24, height: 24}} src={navLabel.iconUrl}/>
            : <SvgIcon component={navLabel.labelIcon} sx={{color: navLabel.iconColor}}/>
        }
        <span className={'ml-1'}>{navLabel.labelText}</span>
        {navLabelArea}
      </div>

      {hasButtons && (
        <div className={'flex items-center ml-2'}>
          {
            buttonOptions.markRead && <div className={'group'}>
                  <Tooltip title={'Mark list as read'} placement={"bottom"}>
                      <IconButton size="small" onClick={onMarkListAsRead}>
                          <CheckIcon fontSize="small"/>
                      </IconButton>
                  </Tooltip>
                  <div className={"group-hover:flex hidden absolute flex-col"}>
                      <Tooltip title={'Mark all as read'} placement={"bottom"}>
                          <IconButton size="small" onClick={onMarkAllAsRead}>
                              <DoneAllIcon fontSize="small"/>
                          </IconButton>
                      </Tooltip>
                  </div>
              </div>
          }

          {
            buttonOptions.viewSwitch && <div className={'group'}>
                  <Tooltip title={'Magazine view'} placement={"bottom"}>
                      <IconButton size="small">
                          <ListAltIcon fontSize="small"/>
                      </IconButton>
                  </Tooltip>
                  <div className={"group-hover:flex hidden absolute flex-col"}>
                      <Tooltip title={'Column view'} placement={"bottom"}>
                          <IconButton size="small">
                              <VerticalSplitOutlinedIcon fontSize="small"/>
                          </IconButton>
                      </Tooltip>
                      <Tooltip title={'List view'} placement={"bottom"}>
                          <IconButton size="small">
                              <ViewHeadlineOutlinedIcon fontSize="small"/>
                          </IconButton>
                      </Tooltip>
                      <Tooltip title={'Expanded view'} placement={"bottom"}>
                          <IconButton size="small">
                              <ViewDayOutlinedIcon fontSize="small"/>
                          </IconButton>
                      </Tooltip>
                  </div>
              </div>
          }
        </div>
      )}
    </div>

    <Box component={"hr"} sx={{
      backgroundColor: "rgba(230, 230, 230, 1)",
      border: 0,
      height: '1px'
    }} className={"m-0"}/>
  </div>
}

export default SubHeader;
