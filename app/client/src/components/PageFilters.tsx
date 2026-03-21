import {
  Button,
  ListItemIcon,
  Menu,
  MenuItem,
  Popover,
  useMediaQuery,
  Portal,
  Tooltip
} from "@mui/material";
import React from "react";
import "./PageFilters.css";
import {SORT_VALUE} from "../model";
import {isDeepEqual} from "../common/objectUtils";
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import {DateRangePicker} from 'react-date-range';
import {
  addDays,
  addHours,
  addMinutes,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameMinute
} from 'date-fns';
import {
  ArchiveOutlined,
  BookmarkBorderOutlined,
  CalendarMonth,
  FolderOpenOutlined,
  HistoryOutlined,
  StarOutlineOutlined,
  TravelExploreOutlined,
  WatchLaterOutlined,
  MarkEmailUnreadOutlined,
  WhatshotOutlined
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
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import { useTranslation } from "react-i18next";

export type SortField = {
  value: SORT_VALUE,
  label?: string
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
  includeArchived?: boolean
  includeArchivedOption?: boolean
}

export type PageFilterProps = {
  options: PageFilterOptions,
  onChange: (props: PageFilterOptions) => void,
}

// Helper to extract date and time from ISO string
function parseDateTimeString(dateStr: string | undefined) {
  if (!dateStr) return { date: undefined, time: '00:00' };
  if (dateStr.includes('T')) {
    const [datePart, timePart] = dateStr.split('T');
    return { date: new Date(datePart), time: timePart?.substring(0, 5) || '00:00' };
  }
  return { date: new Date(dateStr), time: '00:00' };
}

// Custom static ranges

export default function PageFilters(props: PageFilterProps) {
  const {options, onChange} = props;
  const {sortFields, defaultSortValue, asc, hideContentTypeFilter, contentFilterType, startDate, endDate, showAllArticles, showAllArticlesOption, includeArchived, includeArchivedOption} = options;
  const [pickerAnchorEl, setPickerAnchorEl] = React.useState(null);
  const parsedStart = parseDateTimeString(startDate);
  const parsedEnd = parseDateTimeString(endDate);
  const [tempStartDate, setTempStartDate] = React.useState<Date | undefined>(parsedStart.date);
  const [tempEndDate, setTempEndDate] = React.useState<Date | undefined>(parsedEnd.date);
  const [startTime, setStartTime] = React.useState(parsedStart.time);
  const [endTime, setEndTime] = React.useState(parsedEnd.time === '00:00' ? '23:59' : parsedEnd.time);
  const { t } = useTranslation(['page', 'common']);
  const initialOptionsRef = React.useRef<PageFilterOptions>(options);
  const hasDateRange = Boolean(tempStartDate && tempEndDate);
  const isPhone = useMediaQuery('(max-width: 720px)');
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [contentAnchorEl, setContentAnchorEl] = React.useState<HTMLElement | null>(null);
  const [sortAnchorEl, setSortAnchorEl] = React.useState<HTMLElement | null>(null);

  const customStaticRanges = [
    {
      label: t('page:last30Min'),
      range: () => ({ startDate: addMinutes(new Date(), -30), endDate: new Date() }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        return isSameMinute(range.startDate, addMinutes(new Date(), -30)) && isSameMinute(range.endDate, new Date());
      },
    },
    {
      label: t('page:last1Hour'),
      range: () => ({ startDate: addHours(new Date(), -1), endDate: new Date() }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        return isSameMinute(range.startDate, addHours(new Date(), -1)) && isSameMinute(range.endDate, new Date());
      },
    },
    {
      label: t('page:last3Hours'),
      range: () => ({ startDate: addHours(new Date(), -3), endDate: new Date() }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        return isSameMinute(range.startDate, addHours(new Date(), -3)) && isSameMinute(range.endDate, new Date());
      },
    },
    {
      label: t('page:last6Hours'),
      range: () => ({ startDate: addHours(new Date(), -6), endDate: new Date() }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        return isSameMinute(range.startDate, addHours(new Date(), -6)) && isSameMinute(range.endDate, new Date());
      },
    },
    {
      label: t('page:today'),
      range: () => ({ startDate: startOfDay(new Date()), endDate: endOfDay(new Date()) }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        return isSameMinute(range.startDate, todayStart) && isSameMinute(range.endDate, todayEnd);
      },
    },
    {
      label: t('page:yesterday'),
      range: () => ({ startDate: startOfDay(addDays(new Date(), -1)), endDate: endOfDay(addDays(new Date(), -1)) }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        const yesterdayStart = startOfDay(addDays(new Date(), -1));
        const yesterdayEnd = endOfDay(addDays(new Date(), -1));
        return isSameMinute(range.startDate, yesterdayStart) && isSameMinute(range.endDate, yesterdayEnd);
      },
    },
    {
      label: t('page:last7Days'),
      range: () => ({ startDate: startOfDay(addDays(new Date(), -6)), endDate: endOfDay(new Date()) }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        const start = startOfDay(addDays(new Date(), -6));
        const end = endOfDay(new Date());
        return isSameMinute(range.startDate, start) && isSameMinute(range.endDate, end);
      },
    },
    {
      label: t('page:thisWeek'),
      range: () => ({ startDate: startOfWeek(new Date()), endDate: endOfWeek(new Date()) }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        const start = startOfWeek(new Date());
        const end = endOfWeek(new Date());
        return isSameMinute(range.startDate, start) && isSameMinute(range.endDate, end);
      },
    },
    {
      label: t('page:thisMonth'),
      range: () => ({ startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()) }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        const start = startOfMonth(new Date());
        const end = endOfMonth(new Date());
        return isSameMinute(range.startDate, start) && isSameMinute(range.endDate, end);
      },
    },
    {
      label: t('page:last30Days'),
      range: () => ({ startDate: startOfDay(addDays(new Date(), -29)), endDate: endOfDay(new Date()) }),
      isSelected: (range: { startDate?: Date; endDate?: Date }) => {
        if (!range.startDate || !range.endDate) return false;
        const start = startOfDay(addDays(new Date(), -29));
        const end = endOfDay(new Date());
        return isSameMinute(range.startDate, start) && isSameMinute(range.endDate, end);
      },
    },
  ];

  const contentLabelMap = {
    0: t('page:allContent'),
    1: t('page:article'),
    4: t('page:snippet'),
    2: t('page:tweet')
  };
  const getSortLabel = (value: SORT_VALUE) => {
    switch (value) {
      case 'ARCHIVED_AT': return t('page:sortByArchived');
      case 'COLLECTED_AT': return t('page:sortByCollected');
      case 'CONNECTED_AT': return t('page:sortByConnected');
      case 'CREATED_AT': return t('page:sortByCreated');
      case 'LAST_READ_AT': return t('page:sortByLastRead');
      case 'READ_LATER_AT': return t('page:sortByReadLater');
      case 'SAVED_AT': return t('page:sortBySaved');
      case 'STARRED_AT': return t('page:sortByStarred');
      case 'UNSORTED_SAVED_AT': return t('page:sortByUnsortedSaved');
      case 'VOTE_SCORE': return t('page:sortByVoteScore');
      default: return 'Sort';
    }
  };
  const contentLabel = contentLabelMap[contentFilterType || 0];
  const sortLabel = getSortLabel(defaultSortValue);
  const orderLabel = asc ? t('page:sortOldest') : t('page:sortNewest');
  const showSort = sortFields.length > 1 || isPhone;
  const showOrder = defaultSortValue !== 'VOTE_SCORE';
  const hasFilterChanges = !isDeepEqual(initialOptionsRef.current, options);

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
    const newStartDate = item.selection.startDate;
    const newEndDate = item.selection.endDate;
    setTempStartDate(newStartDate);
    setTempEndDate(newEndDate);
    // Extract time from selected dates (for quick ranges)
    if (newStartDate) {
      const h = newStartDate.getHours().toString().padStart(2, '0');
      const m = newStartDate.getMinutes().toString().padStart(2, '0');
      setStartTime(`${h}:${m}`);
    }
    if (newEndDate) {
      const h = newEndDate.getHours().toString().padStart(2, '0');
      const m = newEndDate.getMinutes().toString().padStart(2, '0');
      setEndTime(`${h}:${m}`);
    }
  }

  function openPicker(event) {
    setPickerAnchorEl(event.currentTarget);
  }

  function handlePickerClose() {
    setPickerAnchorEl(null);
    if (!tempStartDate || !tempEndDate) return;
    const strStartDate = `${moment(tempStartDate).format('YYYY-MM-DD')}T${startTime}:00`;
    const strEndDate = `${moment(tempEndDate).format('YYYY-MM-DD')}T${endTime}:00`;
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
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setStartTime('00:00');
    setEndTime('23:59');
    onChange({
      ...options,
      startDate: undefined,
      endDate: undefined
    });
  }

  function handleShowAllArticlesToggle() {
    onChange({
      ...options,
      showAllArticles: !showAllArticles
    });
  }

  function handleOrderToggle() {
    onChange({
      ...options,
      asc: !asc
    });
  }

  function handleIncludeArchivedToggle() {
    onChange({
      ...options,
      includeArchived: !includeArchived
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
    COLLECTED_AT: <FolderOpenOutlined fontSize="small" />,
    CONNECTED_AT: <TwitterIcon fontSize="small" />,
    CREATED_AT: <TravelExploreOutlined fontSize="small" />,
    LAST_READ_AT: <HistoryOutlined fontSize="small" />,
    READ_LATER_AT: <WatchLaterOutlined fontSize="small" />,
    SAVED_AT: <BookmarkBorderOutlined fontSize="small" />,
    STARRED_AT: <StarOutlineOutlined fontSize="small" />,
    UNSORTED_SAVED_AT: <BookmarkBorderOutlined fontSize="small" />,
    VOTE_SCORE: <WhatshotOutlined fontSize="small" />
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
        {t('page:filtersLabel')}
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

          {showAllArticlesOption && (
            <Button
              size="small"
              className={`page-filters-pill ${showAllArticles ? 'is-active' : ''}`}
              startIcon={showAllArticles ? <GridViewOutlinedIcon fontSize="small" /> : <MarkEmailUnreadOutlined fontSize="small" />}
              onClick={handleShowAllArticlesToggle}
            >
              {showAllArticles ? t('page:allContent') : t('page:unread')}
            </Button>
          )}

          {includeArchivedOption && (
            <Tooltip title={includeArchived ? t('page:includeArchived') : t('page:clickToIncludeArchived')} arrow>
              <span
                className={`page-filters-archive-toggle ${includeArchived ? 'is-active' : ''}`}
                onClick={handleIncludeArchivedToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleIncludeArchivedToggle()}
              >
                <ArchiveOutlined fontSize="small" />
                {includeArchived ? <RadioButtonCheckedIcon className="toggle-icon" /> : <RadioButtonUncheckedIcon className="toggle-icon" />}
              </span>
            </Tooltip>
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

          <Button
            size="small"
            className={`page-filters-pill page-filters-date ${hasDateRange ? 'has-range' : 'is-empty'}`}
            startIcon={<CalendarMonth fontSize="small" />}
            onClick={openPicker}
          >
            {hasDateRange ? (
              <span className="page-filters-date-label">
                {`${moment(tempStartDate).format('M/D')} ${startTime} - ${moment(tempEndDate).format('M/D')} ${endTime}`}
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
                    aria-label={t('page:clearDateRange')}
                >
                  <ClearIcon fontSize="small" />
                </span>
              </span>
            ) : null}
          </Button>

          {showOrder && (
            <Button
              size="small"
              className={'page-filters-pill'}
              startIcon={activeOrderIcon}
              onClick={handleOrderToggle}
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

        {showAllArticlesOption && (
          <Button
            size="small"
            className={`page-filters-pill ${showAllArticles ? 'is-active' : ''}`}
            startIcon={showAllArticles ? <GridViewOutlinedIcon fontSize="small" /> : <MarkEmailUnreadOutlined fontSize="small" />}
            onClick={handleShowAllArticlesToggle}
          >
            {showAllArticles ? t('page:allContent') : t('page:unread')}
          </Button>
        )}

        {includeArchivedOption && (
          <Tooltip title={includeArchived ? t('page:includeArchived') : t('page:clickToIncludeArchived')} arrow>
            <span
              className={`page-filters-archive-toggle ${includeArchived ? 'is-active' : ''}`}
              onClick={handleIncludeArchivedToggle}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleIncludeArchivedToggle()}
            >
              <ArchiveOutlined fontSize="small" />
              {includeArchived ? <RadioButtonCheckedIcon className="toggle-icon" /> : <RadioButtonUncheckedIcon className="toggle-icon" />}
            </span>
          </Tooltip>
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

        <Button
          size="small"
          className={`page-filters-pill page-filters-date ${hasDateRange ? 'has-range' : 'is-empty'}`}
          startIcon={<CalendarMonth fontSize="small" />}
          onClick={openPicker}
        >
          {hasDateRange ? (
            <span className="page-filters-date-label">
              {`${moment(tempStartDate).format('M/D')} ${startTime} - ${moment(tempEndDate).format('M/D')} ${endTime}`}
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
                aria-label={t('page:clearDateRange')}
              >
                <ClearIcon fontSize="small" />
              </span>
            </span>
          ) : null}
        </Button>

        {showOrder && (
          <Button
            size="small"
            className={'page-filters-pill'}
            startIcon={activeOrderIcon}
            onClick={handleOrderToggle}
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
        {t('page:allContent')}
        {(contentFilterType === 0 || !contentFilterType) && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
      <MenuItem
        selected={contentFilterType === 1}
        onClick={() => { handleContentFilterChange(null, '1'); setContentAnchorEl(null); }}
      >
        <ListItemIcon>{contentIconMap[1]}</ListItemIcon>
        {t('page:article')}
        {contentFilterType === 1 && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
      <MenuItem
        selected={contentFilterType === 4}
        onClick={() => { handleContentFilterChange(null, '4'); setContentAnchorEl(null); }}
      >
        <ListItemIcon>{contentIconMap[4]}</ListItemIcon>
        {t('page:snippet')}
        {contentFilterType === 4 && <CheckIcon fontSize="small" className="page-filters-check" />}
      </MenuItem>
      <MenuItem
        selected={contentFilterType === 2}
        onClick={() => { handleContentFilterChange(null, '2'); setContentAnchorEl(null); }}
      >
        <ListItemIcon>{contentIconMap[2]}</ListItemIcon>
        {t('page:tweet')}
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
            {getSortLabel(field.value)}
            {defaultSortValue === field.value && <CheckIcon fontSize="small" className="page-filters-check" />}
          </MenuItem>
        ))}
      </Menu>
    )}

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
        className="page-filters-date-popover"
      >
        <DateRangePicker ranges={[{
          startDate: tempStartDate,
          endDate: tempEndDate,
          key: 'selection'
        }]}
                         staticRanges={customStaticRanges}
                         inputRanges={[]}
                         showSelectionPreview={true}
                         moveRangeOnFirstSelection={false}
                         months={2}
                         onChange={handleDateChange}/>
        <div className="page-filters-time-picker">
          <input
            type="time"
            className="time-input"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <span className="page-filters-time-separator">—</span>
          <input
            type="time"
            className="time-input"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </Popover>
    )}
  </div>;
}