import {
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel, IconButton, Popover,
  Radio,
  RadioGroup, Switch, ToggleButton,
  ToggleButtonGroup
} from "@mui/material";
import React from "react";
import {SORT_VALUE} from "../model";
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import {DateRangePicker} from 'react-date-range';
import {CalendarMonth} from "@mui/icons-material";
import moment from "moment";
import ClearIcon from '@mui/icons-material/Clear';

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
    onChange({
      ...options,
      contentFilterType: value
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

  return <div className={'text-[14px]'}>
    {
      !hideContentTypeFilter && <FormControl className={''}>
            <FormLabel id={'date-label'}>CONTENT</FormLabel>
            <ToggleButtonGroup
                className={'mt-2'}
                color="primary"
                exclusive
                value={(contentFilterType || 0).toString()}
                aria-label="content filter"
                size={"small"}
                onChange={handleContentFilterChange}
            >
                <ToggleButton value="0">All</ToggleButton>
                <ToggleButton value="1">Article</ToggleButton>
                <ToggleButton value="2">Tweet</ToggleButton>
            </ToggleButtonGroup>
        </FormControl>
    }

    <div className={`${hideContentTypeFilter ? "" : "mt-4"}`}>
      <div className={''}>
        <div className={'w-11/12'}>
          <div className={'flex items-center text-base cursor-pointer'}>
            <div className={'flex items-center text-[rgba(0,0,0,0.7)] grow'} onClick={openPicker}>
              <CalendarMonth sx={{color: '#1976d2', mr: 1, my: 0.5}}/>
              {tempStartDate && tempEndDate ? <span>
              {moment(tempStartDate).format('L')} - {moment(tempEndDate).format('L')}
            </span> :
                <span>
              Date range
            </span>
              }
            </div>
            {
              tempStartDate && tempEndDate && <span className={'ml-1'}>
                <IconButton size={"small"} onClick={handleClearDate}>
                  <ClearIcon fontSize={"small"}/>
                </IconButton>
              </span>
            }
          </div>
          <Divider/>
        </div>
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
      </div>
    </div>

    {
      options.showAllArticlesOption && (
        <FormControl className={`mt-4`}>
          <FormControlLabel
            control={
              <Switch
                checked={options.showAllArticles || false}
                onChange={(e, checked) => {
                  onChange({
                    ...options,
                    showAllArticles: checked
                  });
                }}
                size="small"
              />
            }
            label="Show all articles"
          />
        </FormControl>
      )
    }

    <FormControl className={`mt-4`} size={"small"}>
      <FormLabel id="sort-field-label">SORT BY</FormLabel>
      <RadioGroup
        aria-labelledby="sort-field-label"
        defaultValue={defaultSortValue}
        name="sort-field-buttons"
        onChange={handleSortByChange}
      >
        {
          sortFields.map((field) => {
            return <FormControlLabel key={field.value} value={field.value} control={<Radio/>} label={field.label}/>;
          })
        }
      </RadioGroup>
    </FormControl>

    {
      defaultSortValue !== 'VOTE_SCORE' &&
        <FormControl className={'mt-2'} size={"small"}>
            <FormLabel id="sorting-label">SORTING</FormLabel>
            <RadioGroup
                aria-labelledby="sorting-label"
                defaultValue={asc ? "true" : "false"}
                name="sorting-buttons"
                onChange={handleSortingChange}
            >
                <FormControlLabel value="false" control={<Radio/>} label="Newest first"/>
                <FormControlLabel value="true" control={<Radio/>} label="Oldest first"/>
            </RadioGroup>
        </FormControl>
    }
  </div>;
}