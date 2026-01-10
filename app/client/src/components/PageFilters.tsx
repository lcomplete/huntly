import {
  Button,
  ListItemIcon,
  Menu,
  MenuItem,
  Popover,
  useMediaQuery,
  Portal
} from "@mui/material";
import React from "react";
import "./PageFilters.css";
import {SORT_VALUE} from "../model";
import {isDeepEqual} from "../common/objectUtils";
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import {DateRangePicker} from 'react-date-range';
import {
  ArchiveOutlined,
  BookmarkBorderOutlined,
  CalendarMonth,
  HistoryOutlined,
  LinkOutlined,
  StarOutlineOutlined,
  ThumbUpOutlined,
  TravelExploreOutlined,
  WatchLaterOutlined
} from "@mui/icons-material";
import moment from "moment";
import ClearIcon from '@mui/icons-material/Clear';
import TuneIcon from '@mui/icons-material/Tune';
import SortOutlinedIcon from '@mui/icons-material/SortOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import FormatQuoteOutlinedIcon from '@mui/icons-material/FormatQuoteOutlined';
import TwitterIcon from '@mui/icons-material/Twitter';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import CheckIcon from '@mui/icons-material/Check';

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
  const initialOptionsRef = React.useRef<PageFilterOptions>(options);
  const hasDateRange = Boolean(tempStartDate && tempEndDate);
  const isPhone = useMediaQuery('(max-width: 720px)');
  const [mobileOpen, setMobileOpen] = React.useState(false);
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
  const showSort = sortFields.length > 1 || isPhone;
  const showOrder = defaultSortValue !== 'VOTE_SCORE';
  const hasFilterChanges = !isDeepEqual(initialOptionsRef.current, options);

  function handleSortingChange(event, value) {
    onChange({
      ...options,
      asc: value === 'true'
    });
    // Close mobile filters after selection
    if (isPhone) {
      setMobileOpen(false);
    }
  }

  function handleSortByChange(event, value) {
    onChange({
      ...options,
      defaultSortValue: value,
      asc: value === 'VOTE_SCORE' ? false : asc
    });
    // Close mobile filters after selection
    if (isPhone) {
      setMobileOpen(false);
    }
  }

  function handleContentFilterChange(event, value) {
    const nextValue = typeof value === 'string' ? value : event?.target?.value;
    onChange({
      ...options,
      contentFilterType: nextValue ? parseInt(nextValue) : 0
    });
    // Close mobile filters after selection
    if (isPhone) {
      setMobileOpen(false);
    }
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

  const contentIconMap = {
    0: <GridViewOutlinedIcon fontSize="small" />,
    1: <ArticleOutlinedIcon fontSize="small" />,
    4: <FormatQuoteOutlinedIcon fontSize="small" />,
    2: <TwitterIcon fontSize="small" />
  };
  const sortIconMap: Record<SORT_VALUE, React.ReactElement> = {
    ARCHIVED_AT: <ArchiveOutlined fontSize="small" />,
    CONNECTED_AT: <LinkOutlined fontSize="small" />,
    CREATED_AT: <TravelExploreOutlined fontSize="small" />,
    LAST_READ_AT: <HistoryOutlined fontSize="small" />,
    READ_LATER_AT: <WatchLaterOutlined fontSize="small" />,
    SAVED_AT: <BookmarkBorderOutlined fontSize="small" />,
    STARRED_AT: <StarOutlineOutlined fontSize="small" />,
    VOTE_SCORE: <ThumbUpOutlined fontSize="small" />
  };
  const activeContentIcon = contentIconMap[contentFilterType || 0];
  const activeSortIcon = sortIconMap[defaultSortValue] ?? <SortOutlinedIcon fontSize="small" />;
  const activeOrderIcon = asc ? <ArrowUpwardOutlinedIcon fontSize="small" /> : <ArrowDownwardOutlinedIcon fontSize="small" />;

  return <div className={'page-filters'}>
    {isPhone && (
      <Button
        size="small"
        className={`page-filters-toggle ${mobileOpen ? 'is-active' : ''} ${hasFilterChanges ? 'has-changes' : ''}`}
        startIcon={<TuneIcon fontSize="small" />}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        Filters
      </Button>
    )}

    {isPhone && mobileOpen && (
      <Portal>
        <div
          className={'page-filters-overlay'}
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setMobileOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close filters"
        />
        <div className={'page-filters-content is-open'}>
          {!hideContentTypeFilter && (
            <Button
              size="small"
              className={'page-filters-pill'}
              startIcon={activeContentIcon}
              onClick={(event) => setContentAnchorEl(event.currentTarget)}
            >
              {contentLabel}
            </Button>
          )}

          {showSort && (
            <Button
              size="small"
              className={'page-filters-pill'}
              startIcon={activeSortIcon}
              onClick={(event) => setSortAnchorEl(event.currentTarget)}
            >
              {sortLabel}
            </Button>
          )}

          {showOrder && (
            <Button
              size="small"
              className={'page-filters-pill'}
              startIcon={activeOrderIcon}
              onClick={(event) => setOrderAnchorEl(event.currentTarget)}
            >
              {orderLabel}
            </Button>
          )}
        </div>
      </Portal>
    )}

    {!isPhone && (
      <div className={'page-filters-content is-open'}>
        {!hideContentTypeFilter && (
          <Button
            size="small"
            className={'page-filters-pill'}
            startIcon={activeContentIcon}
            onClick={(event) => setContentAnchorEl(event.currentTarget)}
          >
            {contentLabel}
          </Button>
        )}

        <Button
          size="small"
          className={`page-filters-pill page-filters-date ${hasDateRange ? 'has-range' : 'is-empty'}`}
          startIcon={<CalendarMonth fontSize="small" />}
          onClick={openPicker}
        >
          {hasDateRange ? (
            <span className="page-filters-date-label">
              {`${moment(tempStartDate).format('L')} - ${moment(tempEndDate).format('L')}`}
              <span
                className="page-filters-date-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  handleClearDate();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleClearDate();
                  }
                }}
                aria-label="Clear date range"
              >
                <ClearIcon fontSize="small" />
              </span>
            </span>
          ) : null}
        </Button>

        {showSort && (
          <Button
            size="small"
            className={'page-filters-pill'}
            startIcon={activeSortIcon}
            onClick={(event) => setSortAnchorEl(event.currentTarget)}
          >
            {sortLabel}
          </Button>
        )}

        {showOrder && (
          <Button
            size="small"
            className={'page-filters-pill'}
            startIcon={activeOrderIcon}
            onClick={(event) => setOrderAnchorEl(event.currentTarget)}
          >
            {orderLabel}
          </Button>
        )}
      </div>
    )}

    <Menu
      anchorEl={contentAnchorEl}
      open={Boolean(contentAnchorEl)}
      onClose={() => setContentAnchorEl(null)}
      PaperProps={{
        className: 'page-filters-menu'
      }}
    >
      <MenuItem
        selected={contentFilterType === 0 || !contentFilterType}
        onClick={() => { handleContentFilterChange(null, '0'); setContentAnchorEl(null); }}
      >
        <ListItemIcon>{contentIconMap[0]}</ListItemIcon>
        All
        {(contentFilterType === 0 || !contentFilterType) && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
      <MenuItem
        selected={contentFilterType === 1}
        onClick={() => { handleContentFilterChange(null, '1'); setContentAnchorEl(null); }}
      >
        <ListItemIcon>{contentIconMap[1]}</ListItemIcon>
        Article
        {contentFilterType === 1 && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
      <MenuItem
        selected={contentFilterType === 4}
        onClick={() => { handleContentFilterChange(null, '4'); setContentAnchorEl(null); }}
      >
        <ListItemIcon>{contentIconMap[4]}</ListItemIcon>
        Snippet
        {contentFilterType === 4 && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
      <MenuItem
        selected={contentFilterType === 2}
        onClick={() => { handleContentFilterChange(null, '2'); setContentAnchorEl(null); }}
      >
        <ListItemIcon>{contentIconMap[2]}</ListItemIcon>
        Tweet
        {contentFilterType === 2 && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
    </Menu>

    {showSort && (
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
            selected={defaultSortValue === field.value}
            onClick={() => { handleSortByChange(null, field.value); setSortAnchorEl(null); }}
          >
            <ListItemIcon>{sortIconMap[field.value]}</ListItemIcon>
            {field.label}
            {defaultSortValue === field.value && <CheckIcon fontSize="small" className="page-filters-check" />}
          </MenuItem>
        ))}
      </Menu>
    )}

    <Menu
      anchorEl={orderAnchorEl}
      open={Boolean(orderAnchorEl)}
      onClose={() => setOrderAnchorEl(null)}
      PaperProps={{
        className: 'page-filters-menu'
      }}
    >
      <MenuItem
        selected={!asc}
        onClick={() => { handleSortingChange(null, 'false'); setOrderAnchorEl(null); }}
      >
        <ListItemIcon><ArrowDownwardOutlinedIcon fontSize="small" /></ListItemIcon>
        Newest first
        {!asc && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
      <MenuItem
        selected={asc}
        onClick={() => { handleSortingChange(null, 'true'); setOrderAnchorEl(null); }}
      >
        <ListItemIcon><ArrowUpwardOutlinedIcon fontSize="small" /></ListItemIcon>
        Oldest first
        {asc && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
    </Menu>

    {!isPhone && (
      <Popover
        open={pickerOpen}
        anchorEl={pickerAnchorEl}
        onClose={handlePickerClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
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
    )}
  </div>;
}