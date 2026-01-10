import {
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  useMediaQuery
} from "@mui/material";
import React from "react";
import "./PageFilters.css";
import {SORT_VALUE} from "../model";
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import {DateRangePicker} from 'react-date-range';
import {CalendarMonth} from "@mui/icons-material";
import moment from "moment";
import ClearIcon from '@mui/icons-material/Clear';
import TuneIcon from '@mui/icons-material/Tune';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import SortOutlinedIcon from '@mui/icons-material/SortOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';

export type SortField = {
  value: SORT_VALUE,
  label: string
}

export type PageFilterOptions = {
  sortFields: SortField[]
  defaultSortValue: SORT_VALUE,
  asc: boolean,
  hideContentTypeFilter?: boolean,
  contentFilterType?: number,
  startDate?: string
  endDate?: string
  showAllArticles?: boolean
  showAllArticlesOption?: boolean
}

export type PageFilterProps = {
  options: PageFilterOptions,
  onChange: (props: PageFilterOptions) => void,
}

export default function PageFilters(props: PageFilterProps) {
  const {options, onChange} = props;
  const {sortFields, defaultSortValue, asc, hideContentTypeFilter, contentFilterType, startDate, endDate} = options;
  const [pickerAnchorEl, setPickerAnchorEl] = React.useState(null);
  const [tempStartDate, setTempStartDate] = React.useState(startDate);
  const [tempEndDate, setTempEndDate] = React.useState(endDate);
  const isMobile = useMediaQuery('(max-width: 720px)');
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const showFilters = !isMobile || mobileOpen;
  const [contentAnchorEl, setContentAnchorEl] = React.useState<HTMLElement | null>(null);
  const [sortAnchorEl, setSortAnchorEl] = React.useState<HTMLElement | null>(null);
  const [orderAnchorEl, setOrderAnchorEl] = React.useState<HTMLElement | null>(null);
  const contentLabelMap = {
    0: 'All',
    1: 'Article',
    4: 'Snippet',
    2: 'Tweet'
  };
  const contentLabel = contentLabelMap[contentFilterType || 0];
  const sortLabel = sortFields.find((field) => field.value === defaultSortValue)?.label || 'Sort';
  const orderLabel = asc ? 'Oldest' : 'Newest';
  const showOrder = defaultSortValue !== 'VOTE_SCORE';

  function handleSortingChange(event, value) {
    onChange({
      ...options,
      asc: value === 'true'
    });
  }

  function handleSortByChange(event, value) {
    onChange({
      ...options,
      defaultSortValue: value,
      asc: value === 'VOTE_SCORE' ? false : asc
    });
  }

  function handleContentFilterChange(event, value) {
    const nextValue = typeof value === 'string' ? value : event?.target?.value;
    onChange({
      ...options,
      contentFilterType: nextValue ? parseInt(nextValue) : 0
    });
  }

  function handleDateChange(item) {
    setTempStartDate(item.selection.startDate);
    setTempEndDate(item.selection.endDate);
  }

  function openPicker(event) {
    setPickerAnchorEl(event.currentTarget);
  }

  function handlePickerClose() {
    setPickerAnchorEl(null);

    if (!tempStartDate || !tempEndDate) {
      return;
    }
    const strStartDate = moment(tempStartDate).format('YYYY-MM-DD');
    const strEndDate = moment(tempEndDate).format('YYYY-MM-DD');

    if (strStartDate !== startDate || strEndDate !== endDate) {
      onChange({
        ...options,
        startDate: strStartDate,
        endDate: strEndDate
      });
    }
  }

  const pickerOpen = Boolean(pickerAnchorEl);

  function handleClearDate() {
    setTempStartDate(null);
    setTempEndDate(null);
    onChange({
      ...options,
      startDate: null,
      endDate: null
    });
  }

  return <div className={'page-filters'}>
    {isMobile && (
      <Button
        size="small"
        className={'page-filters-toggle'}
        startIcon={<TuneIcon fontSize="small" />}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        Filters
      </Button>
    )}

    <div className={`page-filters-content ${showFilters ? 'is-open' : ''}`}>
      {!hideContentTypeFilter && (
        <Button
          size="small"
          className={'page-filters-pill'}
          startIcon={<CategoryOutlinedIcon fontSize="small" />}
          onClick={(event) => setContentAnchorEl(event.currentTarget)}
        >
          {contentLabel}
        </Button>
      )}

      <Button
        size="small"
        className={'page-filters-pill'}
        startIcon={<CalendarMonth fontSize="small" />}
        onClick={openPicker}
      >
        {tempStartDate && tempEndDate
          ? `${moment(tempStartDate).format('L')} - ${moment(tempEndDate).format('L')}`
          : 'Date range'}
      </Button>
      {tempStartDate && tempEndDate && (
        <IconButton size={"small"} onClick={handleClearDate} className={'page-filters-clear'}>
          <ClearIcon fontSize={"small"}/>
        </IconButton>
      )}

      <Button
        size="small"
        className={'page-filters-pill'}
        startIcon={<SortOutlinedIcon fontSize="small" />}
        onClick={(event) => setSortAnchorEl(event.currentTarget)}
      >
        {sortLabel}
      </Button>

      {showOrder && (
        <Button
          size="small"
          className={'page-filters-pill'}
          startIcon={<SwapVertOutlinedIcon fontSize="small" />}
          onClick={(event) => setOrderAnchorEl(event.currentTarget)}
        >
          {orderLabel}
        </Button>
      )}
    </div>

    <Menu
      anchorEl={contentAnchorEl}
      open={Boolean(contentAnchorEl)}
      onClose={() => setContentAnchorEl(null)}
      PaperProps={{
        className: 'page-filters-menu'
      }}
    >
      <MenuItem onClick={() => { handleContentFilterChange(null, '0'); setContentAnchorEl(null); }}>
        All
      </MenuItem>
      <MenuItem onClick={() => { handleContentFilterChange(null, '1'); setContentAnchorEl(null); }}>
        Article
      </MenuItem>
      <MenuItem onClick={() => { handleContentFilterChange(null, '4'); setContentAnchorEl(null); }}>
        Snippet
      </MenuItem>
      <MenuItem onClick={() => { handleContentFilterChange(null, '2'); setContentAnchorEl(null); }}>
        Tweet
      </MenuItem>
    </Menu>

    <Menu
      anchorEl={sortAnchorEl}
      open={Boolean(sortAnchorEl)}
      onClose={() => setSortAnchorEl(null)}
      PaperProps={{
        className: 'page-filters-menu'
      }}
    >
      {sortFields.map((field) => (
        <MenuItem
          key={field.value}
          onClick={() => { handleSortByChange(null, field.value); setSortAnchorEl(null); }}
        >
          {field.label}
        </MenuItem>
      ))}
    </Menu>

    <Menu
      anchorEl={orderAnchorEl}
      open={Boolean(orderAnchorEl)}
      onClose={() => setOrderAnchorEl(null)}
      PaperProps={{
        className: 'page-filters-menu'
      }}
    >
      <MenuItem onClick={() => { handleSortingChange(null, 'false'); setOrderAnchorEl(null); }}>
        Newest first
      </MenuItem>
      <MenuItem onClick={() => { handleSortingChange(null, 'true'); setOrderAnchorEl(null); }}>
        Oldest first
      </MenuItem>
    </Menu>

    <Popover open={pickerOpen} anchorEl={pickerAnchorEl} onClose={handlePickerClose} anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'center',
    }}>
      <DateRangePicker ranges={[{
        startDate: tempStartDate,
        endDate: tempEndDate,
        key: 'selection'
      }]}
                       showSelectionPreview={true}
                       moveRangeOnFirstSelection={false}
                       months={2}
                       onChange={handleDateChange}/>
    </Popover>
  </div>;
}