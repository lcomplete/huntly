import {Box, IconButton, SvgIcon, Tooltip} from "@mui/material";
import "./SubHeader.css";
import * as React from "react";
import { useTranslation } from 'react-i18next';
import {ReactElement} from "react";
import {NavLabel, getTranslatedLabel} from "./Navigation/shared/NavLabels";
import { setDocTitle } from "../common/docUtils";
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
  documentTitle?: string,
  onMarkListAsRead?: () => void,
  onMarkAllAsRead?: () => void,
  buttonOptions?: ButtonOptions,
  navLabelArea?: ReactElement,
  rightContent?: ReactElement,
  hideSearchOnMobile?: boolean,
  defaultSearchKeywords?: string[],
  defaultSearchText?: string
}

const SubHeader = (props: SubHeaderProps) => {
  const { t } = useTranslation('navigation');
  const {
    navLabel,
    documentTitle,
    navLabelArea,
    onMarkListAsRead,
    onMarkAllAsRead,
    rightContent,
    hideSearchOnMobile = true,
    defaultSearchKeywords,
    defaultSearchText
  } = props;
  const defaultBtnOptions: ButtonOptions = {markRead: true, viewSwitch: false};
  const buttonOptions = {...defaultBtnOptions, ...props.buttonOptions};

  const viewOptions = [
    {id: 'magazine', label: t('magazineView'), icon: ListAltIcon},
    {id: 'column', label: t('columnView'), icon: VerticalSplitOutlinedIcon},
    {id: 'list', label: t('listView'), icon: ViewHeadlineOutlinedIcon},
    {id: 'expanded', label: t('expandedView'), icon: ViewDayOutlinedIcon}
  ] as const;

  const [viewMode, setViewMode] = React.useState<typeof viewOptions[number]['id']>('magazine');
  const activeView = viewOptions.find((option) => option.id === viewMode) ?? viewOptions[0];
  const ActiveViewIcon = activeView.icon;

  React.useEffect(() => {
    if (documentTitle) {
      setDocTitle(documentTitle);
    }
  }, [documentTitle]);

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
          {navLabel.showLabel !== false && <span className={'subheader-label'} title={getTranslatedLabel(navLabel)}>{getTranslatedLabel(navLabel)}</span>}
          {navLabelArea}
        </div>

        {hasButtons && (
          <div className={'subheader-actions subheader-actions-left'}>
            {
              buttonOptions.markRead && <div className={'group relative'}>
                  <Tooltip title={t('markListAsRead')} placement={"right"} disableInteractive>
                      <IconButton className={'group-hover:shadow-heavy group-hover:bg-white'} onClick={onMarkListAsRead}>
                          <CheckIcon fontSize="small"/>
                      </IconButton>
                  </Tooltip>
                  <div className={'group-hover:flex hidden absolute flex-col z-40'}>
                      <Tooltip title={t('markAllAsRead')} placement={"right"} disableInteractive>
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
          <SearchBox selectedKeywords={defaultSearchKeywords} defaultSearchText={defaultSearchText} />
        </div>
      </div>
    </div>
  </div>
}

export default SubHeader;
