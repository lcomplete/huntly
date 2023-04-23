import SearchIcon from "@mui/icons-material/Search";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {
  Autocomplete,
  Box,
  Chip, createFilterOptions,
  FilterOptionsState,
  IconButton,
  InputBase,
  Paper,
} from "@mui/material";
import TuneIcon from '@mui/icons-material/Tune';
import {createSearchParams, useNavigate, useSearchParams} from "react-router-dom";
import {styled} from "@mui/material/styles";
import ArticleIcon from '@mui/icons-material/Article';
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import HistoryIcon from '@mui/icons-material/History';
import {SearchControllerApiFactory} from "../api";
import {useQuery} from "@tanstack/react-query";

export default function SearchBox() {
  const [focus, setFocus] = useState(false);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const queryOp = params.get('op') ? params.get('op').split(',') : [];
  const queryOptions = defaultSearchOptions.filter(option => queryOp.indexOf(option.keyword) >= 0);
  const [searchText, setSearchText] = useState('');
  const [searchOptions, setSearchOptions] = React.useState<SearchOption[]>(queryOptions);

  useEffect(() => {
    setSearchText(params.get('q') || '');
    setSearchOptions(defaultSearchOptions.filter(option => queryOp.indexOf(option.keyword) >= 0));
  }, [params]);

  function inputFocus() {
    setFocus(true);
  }

  function inputBlur() {
    setFocus(false);
  }

  function inputChange(e) {
    setSearchText(e.target.value || '');
  }

  function clearInput() {
    setSearchText('');
  }

  function searchSubmit(e) {
    e.preventDefault();
    if (!searchText.trim() && searchOptions.length === 0) {
      return;
    }
    // use set search params
    navigate({
      pathname: "/search",
      search: `?${createSearchParams({
        'q': searchText.trim(),
        'op': searchOptions.filter(option => defaultSearchOptions.map(def => def.keyword).indexOf(option.keyword) >= 0).map(option => option.keyword).join(',')
      })}`
    });
  }

  let allSearchOptions = defaultSearchOptions;
  const {
    data: recentSearches,
    refetch: refetchRecentSearches,
  } = useQuery(["recent_search"], async () => {
    return (await SearchControllerApiFactory().getRecentSearchesUsingGET()).data
  });
  if (recentSearches) {
    const recentSearchOptions: SearchOption[] = recentSearches.map(search => ({
      type: 'Recent',
      label: search.query,
      keyword: ""
    }));
    allSearchOptions = [...recentSearchOptions, ...defaultSearchOptions];
  }

  function handleChangeOptions(options: SearchOption[]) {
    const results = [];
    const mapResults = {};
    let clearText = true;
    for (const option of options) {
      if (typeof option === 'string') {
        clearText = false;
        continue;
      }
      if (!option.keyword) {
        clearText = false;
        setSearchText(option.label);
        continue;
      }
      if (!mapResults[option.type]) {
        mapResults[option.type] = [];
      }
      if (option.type !== 'Options') {
        mapResults[option.type] = [option];
      } else {
        mapResults[option.type].push(option);
      }
    }
    if (clearText) {
      setSearchText("");
    }
    for (const key in mapResults) {
      results.push(...mapResults[key]);
    }
    setSearchOptions(results);
  }

  function inputKeyDown(event) {
    switch (event.key) {
      case "Tab": {
        if (event.target.value.trim() !== '') {
          if (filteringOptions.current.length > 0) {
            handleChangeOptions([
              ...searchOptions,
              filteringOptions.current[0]
            ]);
            if (filteringOptions.current[0].keyword) {
              setSearchText('');
            }
            event.preventDefault();
          }
        }
        break;
      }
    }
  }

  function inputKeyUp(event) {
    switch (event.key) {
      case "Enter": {
        event.preventDefault()
        searchSubmit(event);
        break;
      }
    }
  }

  const rawFilterOptions = createFilterOptions<SearchOption>();
  let filteringOptions = useRef<SearchOption[]>([]);

  const filterOptions = useCallback((options: SearchOption[], state: FilterOptionsState<SearchOption>) => {
    const filtered = rawFilterOptions(options, state);
    filteringOptions.current = filtered;
    return filtered;
  }, []);

  return (
    <div className={'search-wrapper'}>
      <div
        className={
          `search-box w-4/12 min-w-[700px] text-xs leading-6 text-slate-400 rounded-md shadow-sm pl-1 pr-1 border-slate-300 border border-solid ${focus ? "bg-white" : "bg-blue-50"}`
        }
      >
        <form action={'/search'} className={'flex grow items-center'} onSubmit={searchSubmit}>
          <IconButton aria-label={"search"} type={"submit"} className={''}>
            <SearchIcon fontSize="small"/>
          </IconButton>
          {/*<InputBase name={'q'} type={"text"} className={"w-full peer"} placeholder={'Search'} onFocus={inputFocus}*/}
          {/*           onChange={inputChange}*/}
          {/*           onBlur={inputBlur} value={searchText}*/}
          {/*/>*/}
          <Autocomplete
            PaperComponent={CustomPaper}
            className={'grow'}
            sx={{
              "& .MuiInputBase-root": {
                display: 'flex',
                alignItems: 'center'
              },
              "& input": {
                paddingBottom: '4px'
              },
              "& .MuiAutocomplete-popupIndicator": {
                p: '4px'
              }
            }}
            multiple
            id="q"
            value={searchOptions}
            inputValue={searchText}
            onOpen={() => {
              refetchRecentSearches()
            }}
            onChange={(event, newValue: SearchOption[]) => {
              handleChangeOptions([
                ...newValue
              ]);
            }}
            filterOptions={filterOptions}
            filterSelectedOptions={true}
            onInputChange={inputChange}
            freeSolo={true}
            forcePopupIcon={true}
            onFocus={inputFocus}
            onBlur={inputBlur}
            options={allSearchOptions}
            getOptionLabel={(option: SearchOption) => option.label}
            groupBy={(option: SearchOption) => option.type}
            renderGroup={(params) => (
              <li key={params.key}>
                <GroupHeader>{params.group}</GroupHeader>
                <GroupItems>{params.children}</GroupItems>
              </li>
            )}
            renderOption={(props, option: SearchOption) => {
              return <li {...props} style={{padding: 0}}>
                <div className={'pl-3 pt-1 pb-1 pr-1 flex items-center cursor-pointer hover:bg-gray-100'}>
                  {option.type === 'Recent' && <Box component={HistoryIcon} color={'gray'}>
                  </Box>}
                  {option.type === 'Type' && <Box component={ArticleIcon} color={'gray'}>
                  </Box>}
                  {option.type === 'Library' && <Box component={LocalLibraryIcon} color={'gray'}>
                  </Box>}
                  {option.type === 'Options' && <Box component={FilterAltIcon} color={'gray'}>
                  </Box>}
                  <span className={'ml-2'}>
                  {option.label}
                </span>
                </div>
              </li>
            }}
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((option, index) => (
                <Chip
                  size={'small'}
                  label={option.keyword}
                  {...getTagProps({index})}
                />
              ))
            }
            renderInput={(params) => {
              const {InputLabelProps, InputProps, ...rest} = params;
              // <TextField {...params} name={'q'} placeholder={'Search'} size={"small"} variant={'standard'} fullWidth={true} />
              return <InputBase {...params.InputProps} {...rest} name={'q'} placeholder={'Search'} type={'text'}
                                onKeyDown={inputKeyDown} onKeyUp={inputKeyUp}
                                sx={{}}
              />;
            }}
            popupIcon={<TuneIcon fontSize={'small'} sx={{}}/>}
          />
        </form>
        {/*{*/}
        {/*  searchText && <IconButton aria-label={'close button'} onClick={clearInput}>*/}
        {/*    <CloseIcon fontSize={'small'}/>*/}
        {/*  </IconButton>*/}
        {/*}*/}
        {/*<IconButton aria-label={'search filter'}>*/}
        {/*  <TuneIcon fontSize={'small'}/>*/}
        {/*</IconButton>*/}
      </div>
    </div>
  )
}


type SearchOption = {
  keyword: string;
  label: string,
  type: 'Recent' | 'Type' | 'Library' | 'Options';
}

const defaultSearchOptions: SearchOption[] = [
  {keyword: 'tweet', label: 'Tweet', type: 'Type'},
  {keyword: 'github', label: 'Github Repository', type: 'Type'},
  {keyword: 'browser', label: 'Browser History', type: 'Type'},
  {keyword: 'feeds', label: 'Feeds', type: 'Type'},
  {keyword: 'list', label: 'My List', type: 'Library'},
  {keyword: 'starred', label: 'Starred', type: 'Library'},
  {keyword: 'later', label: 'Read Later', type: 'Library'},
  {keyword: 'archive', label: 'Archive', type: 'Library'},
  {keyword: 'read', label: 'Already Read', type: 'Options'},
  {keyword: 'title', label: 'Only Search Title', type: 'Options'},
];

const CustomPaper = (props) => {
  return <Paper elevation={14} {...props} />;
};

const GroupHeader = styled('div')(({theme}) => ({
  // position: 'sticky',
  // top: '-8px',
  padding: '2px 10px',
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#57606a',
  // backgroundColor:
  //   theme.palette.mode === 'light'
  //     ? lighten(theme.palette.primary.light, 0.9)
  //     : darken(theme.palette.primary.main, 0.9),
}));

const GroupItems = styled('ul')({
  borderBottom: '1px solid #ccc',
  padding: 0,
  fontSize: '14px',
  marginBottom: '10px',
  paddingBottom: '8px'
});