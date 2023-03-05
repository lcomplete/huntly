import {FormControl, FormControlLabel, FormLabel, Radio, RadioGroup} from "@mui/material";
import React from "react";
import {SORT_VALUE} from "../model";

export type SortField = {
  value: SORT_VALUE,
  label: string
}

export type PageFilterOptions = {
  sortFields: SortField[]
  defaultSortValue: SORT_VALUE,
  asc: boolean,
}

export type PageFilterProps = {
  options: PageFilterOptions,
  onChange: (props: PageFilterOptions) => void,
}

export default function PageFilters(props: PageFilterProps) {
  const {options, onChange} = props;
  const {sortFields, defaultSortValue, asc} = options;

  function handleSortingChange(event, value) {
    onChange({
      ...options,
      asc: value === 'true'
    });
  }

  function handleSortByChange(event, value) {
    onChange({
      ...options,
      defaultSortValue: value
    });
  }

  return <div className={'text-[14px]'}>
    <FormControl>
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

    <FormControl className={'mt-2'}>
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
  </div>;
}