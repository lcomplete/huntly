import {Box, IconButton, SvgIcon, Tooltip} from "@mui/material";
import * as React from "react";
import {ReactElement} from "react";
import {NavLabel} from "./Sidebar/NavLabels";
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ViewHeadlineOutlinedIcon from '@mui/icons-material/ViewHeadlineOutlined';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';
import ViewDayOutlinedIcon from '@mui/icons-material/ViewDayOutlined';


export type ButtonOptions = {
  markRead?: boolean,
  viewSwitch?: boolean,
  refresh?: boolean
}

type SubHeaderProps = {
  navLabel: NavLabel,
  onMarkListAsRead?: () => void,
  onMarkAllAsRead?: () => void,
  onRefresh?: () => void,
  buttonOptions?: ButtonOptions,
  navLabelArea?: ReactElement
}

const SubHeader = (props: SubHeaderProps) => {
  const {
    navLabel,
    navLabelArea,
    onMarkListAsRead,
    onMarkAllAsRead,
    onRefresh
  } = props;
  const defaultBtnOptions: ButtonOptions = {markRead: true, viewSwitch: false, refresh: true};
  const buttonOptions = {...defaultBtnOptions, ...props.buttonOptions};

  return <div className={'subheader w-full'}>
    <div className={'flex content-between border-b-gray-500 pl-3 pr-3 pt-1 pb-1'}>
      <div className={'flex items-center'}>
        {
          navLabel.iconUrl ? <Box component={'img'}
                         sx={{mr: 1, width: 24, height: 24}} src={navLabel.iconUrl}/>
            : <SvgIcon component={navLabel.labelIcon} sx={{color: navLabel.iconColor}}/>
        }
        <span className={'ml-1'}>{navLabel.labelText}</span>
        {navLabelArea}
      </div>

      <div className={'ml-auto'}>
        <div className={'flex'}>
          {
            buttonOptions.markRead && <div className={'group'}>
                  <Tooltip title={'Mark list as read'} placement={"left"}>
                      <IconButton onClick={onMarkListAsRead}>
                          <CheckIcon/>
                      </IconButton>
                  </Tooltip>
                  <div className={"group-hover:flex hidden absolute flex-col"}>
                      <Tooltip title={'Mark all as read'} placement={"left"}>
                          <IconButton onClick={onMarkAllAsRead}>
                              <DoneAllIcon/>
                          </IconButton>
                      </Tooltip>
                  </div>
              </div>
          }

          {
            buttonOptions.viewSwitch && <div className={'group'}>
                  <Tooltip title={'Magazine view'} placement={"left"}>
                      <IconButton>
                          <ListAltIcon/>
                      </IconButton>
                  </Tooltip>
                  <div className={"group-hover:flex hidden absolute flex-col"}>
                      <Tooltip title={'Column view'} placement={"left"}>
                          <IconButton>
                              <VerticalSplitOutlinedIcon/>
                          </IconButton>
                      </Tooltip>
                      <Tooltip title={'List view'} placement={"left"}>
                          <IconButton>
                              <ViewHeadlineOutlinedIcon/>
                          </IconButton>
                      </Tooltip>
                      <Tooltip title={'Expanded view'} placement={"left"}>
                          <IconButton>
                              <ViewDayOutlinedIcon/>
                          </IconButton>
                      </Tooltip>
                  </div>
              </div>
          }

          {
            buttonOptions.refresh && <Tooltip title={'Refresh'} placement={"bottom"}>
                  <IconButton onClick={onRefresh}>
                      <RefreshIcon/>
                  </IconButton>
              </Tooltip>
          }

        </div>
      </div>
    </div>

    <Box component={"hr"} sx={{
      "background-color": "rgba(230, 230, 230, 1)",
      border: 0,
      height: '1px'
    }} className={"m-0"}/>
  </div>
}

export default SubHeader;