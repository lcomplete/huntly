import SearchIcon from "@mui/icons-material/Search";
import "./SearchBox.css";
import React, {useCallback, useEffect, useRef, useState} from "react";
import type {AutocompleteInputChangeReason} from "@mui/material/Autocomplete";
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
import { useTranslation } from "react-i18next";

type SearchOption = {
  keyword: string;
  label: string,
  type: 'Recent' | 'Type' | 'Library' | 'Options' | 'Advanced'
}

type SearchBoxProps = Readonly<{
  variant?: 'default' | 'large';
  value?: string;
  onValueChange?: (value: string) => void;
  selectedKeywords?: string[];
  onSelectedKeywordsChange?: (keywords: string[]) => void;
  focusSignal?: number;
  defaultSearchText?: string;
}>;

const defaultSearchOptions: SearchOption[] = [
  {keyword: 'url:', label: 'url:{url}', type: 'Advanced'},
  {keyword: 'author:', label: 'author:{author}', type: 'Advanced'},
  {keyword: 'collection:', label: 'collection:{name}', type: 'Advanced'},
  {keyword: 'tweet', label: 'Tweet', type: 'Type'},
  {keyword: 'github', label: 'Github Repository', type: 'Type'},
  {keyword: 'browser', label: 'Browser History', type: 'Type'},
  {keyword: 'feeds', label: 'Feeds', type: 'Type'},
  {keyword: 'list', label: 'My List', type: 'Library'},
  {keyword: 'highlights', label: 'Highlights', type: 'Library'},
  {keyword: 'starred', label: 'Starred', type: 'Library'},
  {keyword: 'later', label: 'Read Later', type: 'Library'},
  {keyword: 'archive', label: 'Archive', type: 'Library'},
  {keyword: 'unsorted', label: 'Unsorted', type: 'Library'},
  {keyword: 'read', label: 'Already Read', type: 'Options'},
  {keyword: 'title', label: 'Only Search Title', type: 'Options'},
];

const rawFilterOptions = createFilterOptions<SearchOption>();
const defaultSearchOptionKeywords = new Set(defaultSearchOptions.map((option) => option.keyword));

function getSearchOptionsByKeywords(keywords: string[]) {
  return defaultSearchOptions.filter((option) => keywords.includes(option.keyword));
}

function buildNextSearchState(options: Array<SearchOption | string>) {
  const groupedOptions: Partial<Record<SearchOption['type'], SearchOption[]>> = {};
  let shouldClearText = true;
  let nextSearchText: string | null = null;

  for (const option of options) {
    if (typeof option === 'string') {
      shouldClearText = false;
      continue;
    }

    if (!option.keyword) {
      shouldClearText = false;
      nextSearchText = option.label;
      continue;
    }

    if (option.type === 'Advanced') {
      shouldClearText = false;
      nextSearchText = option.keyword;
      continue;
    }

    if (option.type === 'Options') {
      groupedOptions[option.type] = [...(groupedOptions[option.type] || []), option];
      continue;
    }

    groupedOptions[option.type] = [option];
  }

  return {
    nextSearchOptions: Object.values(groupedOptions).flat(),
    nextSearchText: shouldClearText ? '' : nextSearchText,
  };
}

export default function SearchBox({
  variant = 'default',
  value,
  onValueChange,
  selectedKeywords,
  onSelectedKeywordsChange,
  focusSignal,
  defaultSearchText
}: SearchBoxProps) {
  const [focus, setFocus] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['page']);
  const isLarge = variant === 'large';
  const isControlled = value !== undefined;
  const hasSelectedKeywords = selectedKeywords !== undefined;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const queryText = params.get('q') || '';
  const queryOpParam = params.get('op') || '';
  const queryOp = React.useMemo(() => (queryOpParam ? queryOpParam.split(',') : []), [queryOpParam]);
  const queryOptions = React.useMemo(() => getSearchOptionsByKeywords(queryOp), [queryOp]);
  const selectedKeywordSignature = selectedKeywords?.join(',') || '';
  const selectedOptionsFromProps = React.useMemo(
    () => getSearchOptionsByKeywords(selectedKeywordSignature ? selectedKeywordSignature.split(',') : []),
    [selectedKeywordSignature]
  );
  const [searchText, setSearchText] = useState(() => queryText || defaultSearchText || '');
  const [searchOptions, setSearchOptions] = React.useState<SearchOption[]>(() => {
    if (hasSelectedKeywords) {
      return getSearchOptionsByKeywords(selectedKeywords);
    }

    return queryOptions;
  });

  useEffect(() => {
    if (!isControlled) {
      setSearchText(queryText || defaultSearchText || '');
    }
  }, [defaultSearchText, isControlled, queryText]);

  useEffect(() => {
    if (isControlled) {
      setSearchText(value || '');
    }
  }, [value, isControlled]);

  useEffect(() => {
    if (hasSelectedKeywords) {
      setSearchOptions(selectedOptionsFromProps);
      return;
    }

    setSearchOptions(queryOptions);
  }, [hasSelectedKeywords, queryOptions, selectedOptionsFromProps]);

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

  function inputChange(_event: React.SyntheticEvent, nextValue: string, reason: AutocompleteInputChangeReason) {
    if (reason === 'reset') {
      return;
    }

    setSearchTextValue(nextValue);
  }

  function searchSubmit(e: React.SyntheticEvent) {
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
        'op': searchOptions
          .filter((option) => defaultSearchOptionKeywords.has(option.keyword))
          .map((option) => option.keyword)
          .join(',')
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

  function handleChangeOptions(options: Array<SearchOption | string>) {
    const {nextSearchOptions, nextSearchText} = buildNextSearchState(options);

    if (nextSearchText !== null) {
      setSearchTextValue(nextSearchText);
    }

    setSearchOptions(nextSearchOptions);

    if (onSelectedKeywordsChange) {
      const nextKeywords = nextSearchOptions
        .map((option) => option.keyword)
        .filter(Boolean);

      onSelectedKeywordsChange?.(nextKeywords);
    }
  }

  function inputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Tab') {
      return;
    }

    if (!event.currentTarget.value.trim() || filteringOptions.current.length === 0) {
      return;
    }

    handleChangeOptions([
      ...searchOptions,
      filteringOptions.current[0]
    ]);
    event.preventDefault();
  }

  function inputKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    searchSubmit(event);
  }

  const filteringOptions = useRef<SearchOption[]>([]);

  const filterOptions = useCallback((options: SearchOption[], state: FilterOptionsState<SearchOption>) => {
    const filtered = rawFilterOptions(options, state);
    filteringOptions.current = filtered;
    return filtered;
  }, []);

  const largeHeight = 52;
  const inputValue = isControlled ? (value || '') : searchText;
  const focusClassName = isLarge
    ? (focus ? 'bg-white border-slate-300 shadow-lg' : 'bg-white border-slate-300 shadow-sm')
    : (focus ? 'bg-white border-slate-300 shadow-md' : 'bg-white border-slate-200');
  const searchBoxBaseClassName = isLarge
    ? 'search-box w-full text-xs leading-6 text-slate-500 rounded-xl pl-2 pr-2 border-2 border-solid transition-all duration-200'
    : 'search-box w-full md:w-4/12 md:min-w-[700px] text-xs leading-6 text-slate-500 rounded-md pl-1 pr-1 border border-solid';
  const searchBoxClassName = `${searchBoxBaseClassName} ${focusClassName}`;

  return (
    <div className={'search-wrapper'}>
      <div
        className={searchBoxClassName}
        style={isLarge ? { minHeight: `${largeHeight}px` } : {}}
      >
        <form action={'/search'} className={'flex grow items-center'} style={isLarge ? { minHeight: `${largeHeight}px` } : {}} onSubmit={searchSubmit}>
          <IconButton aria-label={"search"} type={"submit"} className={''}>
            <SearchIcon fontSize={isLarge ? "medium" : "small"}/>
          </IconButton>
          <Autocomplete<SearchOption, true, false, true>
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
            onChange={(_event, newValue) => {
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
            getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
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
              return <InputBase {...params.InputProps} {...rest} name={'q'} placeholder={isLarge ? t('page:searchEverythingPlaceholder') : t('page:searchLabel')} type={'text'}
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
      </div>
    </div>
  )
}



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
