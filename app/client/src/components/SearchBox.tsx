import SearchIcon from "@mui/icons-material/Search";
import "./SearchBox.css";
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

type SearchBoxProps = {
  variant?: 'default' | 'large';
  value?: string;
  onValueChange?: (value: string) => void;
  selectedKeywords?: string[];
  onSelectedKeywordsChange?: (keywords: string[]) => void;
  focusSignal?: number;
}

export default function SearchBox({
  variant = 'default',
  value,
  onValueChange,
  selectedKeywords,
  onSelectedKeywordsChange,
  focusSignal
}: SearchBoxProps) {
  const [focus, setFocus] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isLarge = variant === 'large';
  const isControlled = value !== undefined;
  const isOptionsControlled = selectedKeywords !== undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const queryOp = params.get('op') ? params.get('op').split(',') : [];
  const queryOptions = defaultSearchOptions.filter(option => queryOp.indexOf(option.keyword) >= 0);
  const [searchText, setSearchText] = useState('');
  const [searchOptions, setSearchOptions] = React.useState<SearchOption[]>(queryOptions);

  useEffect(() => {
    if (!isControlled) {
      setSearchText(params.get('q') || '');
    }
    if (!isOptionsControlled) {
      setSearchOptions(defaultSearchOptions.filter(option => queryOp.indexOf(option.keyword) >= 0));
    }
  }, [params, isControlled, isOptionsControlled]);

  useEffect(() => {
    if (isControlled) {
      setSearchText(value || '');
    }
  }, [value, isControlled]);

  useEffect(() => {
    if (isOptionsControlled) {
      const keywords = selectedKeywords || [];
      setSearchOptions(defaultSearchOptions.filter(option => keywords.includes(option.keyword)));
    }
  }, [selectedKeywords, isOptionsControlled]);

  useEffect(() => {
    if (focusSignal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusSignal]);

  function inputFocus() {
    setFocus(true);
  }

  function inputBlur() {
    setFocus(false);
  }

  function setSearchTextValue(nextValue: string) {
    if (isControlled) {
      onValueChange?.(nextValue);
      return;
    }
    setSearchText(nextValue);
  }

  function inputChange(e) {
    setSearchTextValue(e.target.value || '');
  }

  function searchSubmit(e) {
    e.preventDefault();
    const submitText = (isControlled ? (value || '') : searchText).trim();
    if (!submitText && searchOptions.length === 0) {
      return;
    }
    // use set search params
    navigate({
      pathname: "/search",
      search: `?${createSearchParams({
        'q': submitText,
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
        setSearchTextValue(option.label);
        continue;
      }
      if(option.type === 'Advanced'){
        clearText = false;
        setSearchTextValue(option.keyword);
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
      setSearchTextValue("");
    }
    for (const key in mapResults) {
      results.push(...mapResults[key]);
    }
    setSearchOptions(results);
    if (isOptionsControlled) {
      const nextKeywords = results
        .map(option => option.keyword)
        .filter(keyword => keyword);
      onSelectedKeywordsChange?.(nextKeywords);
    }
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

  const largeHeight = 52;
  const inputValue = isControlled ? (value || '') : searchText;

  return (
    <div className={'search-wrapper'}>
      <div
        className={
          isLarge
            ? `search-box w-full text-xs leading-6 text-slate-500 rounded-xl pl-2 pr-2 border-2 border-solid transition-all duration-200 ${focus ? "bg-white border-slate-300 shadow-lg" : "bg-white border-slate-300 shadow-sm"}`
            : `search-box w-4/12 min-w-[700px] text-xs leading-6 text-slate-500 rounded-md pl-1 pr-1 border border-solid ${focus ? "bg-white border-slate-300 shadow-md" : "bg-white border-slate-200"}`
        }
        style={isLarge ? { minHeight: `${largeHeight}px` } : {}}
      >
        <form action={'/search'} className={'flex grow items-center'} style={isLarge ? { minHeight: `${largeHeight}px` } : {}} onSubmit={searchSubmit}>
          <IconButton aria-label={"search"} type={"submit"} className={''}>
            <SearchIcon fontSize={isLarge ? "medium" : "small"}/>
          </IconButton>
          {/*<InputBase name={'q'} type={"text"} className={"w-full peer"} placeholder={'Search'} onFocus={inputFocus}*/}
          {/*           onChange={inputChange}*/}
          {/*           onBlur={inputBlur} value={searchText}*/}
          {/*/>*/}
          <Autocomplete
            PaperComponent={CustomPaper}
            className={'grow'}
            sx={{
              display: 'flex',
              alignItems: 'center',
              minHeight: isLarge ? `${largeHeight}px` : 'auto',
              "& .MuiInputBase-root": {
                display: 'flex',
                alignItems: 'center',
                minHeight: isLarge ? `${largeHeight}px` : 'auto',
                paddingTop: isLarge ? '0 !important' : 'inherit',
                paddingBottom: isLarge ? '0 !important' : 'inherit'
              },
              "& input": {
                paddingTop: '0 !important',
                paddingBottom: '0 !important',
                fontSize: isLarge ? '15px' : '14px',
                fontWeight: isLarge ? 400 : 'inherit'
              },
              "& .MuiAutocomplete-popupIndicator": {
                p: '4px'
              },
              "& .MuiChip-root": {
                height: isLarge ? '28px' : '24px',
                fontSize: isLarge ? '13px' : '12px'
              }
            }}
            multiple
            id="q"
            value={searchOptions}
            inputValue={inputValue}
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
                  {option.type === 'Advanced' && <Box component={SearchIcon} color={'gray'}>
                  </Box>}
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
              return <InputBase {...params.InputProps} {...rest} name={'q'} placeholder={isLarge ? 'Search everything in Huntly...' : 'Search'} type={'text'}
                                onKeyDown={inputKeyDown} onKeyUp={inputKeyUp}
                                inputRef={inputRef}
                                sx={{
                                  '& input::placeholder': {
                                    fontSize: isLarge ? '15px' : '14px',
                                    color: '#94a3b8'
                                  }
                                }}
              />;
            }}
            popupIcon={<TuneIcon fontSize={isLarge ? 'medium' : 'small'} />}
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
  type: 'Recent' | 'Type' | 'Library' | 'Options' | 'Advanced'
}

const defaultSearchOptions: SearchOption[] = [
  {keyword: 'url:', label: 'url:{url}', type: 'Advanced'},
  {keyword: 'author:', label: 'author:{author}', type: 'Advanced'},
  {keyword: 'tweet', label: 'Tweet', type: 'Type'},
  {keyword: 'github', label: 'Github Repository', type: 'Type'},
  {keyword: 'browser', label: 'Browser History', type: 'Type'},
  {keyword: 'feeds', label: 'Feeds', type: 'Type'},
  {keyword: 'list', label: 'My List', type: 'Library'},
  {keyword: 'highlights', label: 'Highlights', type: 'Library'},
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
