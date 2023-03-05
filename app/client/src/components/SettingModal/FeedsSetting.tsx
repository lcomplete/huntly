import Typography from "@mui/material/Typography";
import {Button, Divider, InputAdornment, TextField} from "@mui/material";
import React, {useState} from "react";
import {PreviewFeedsInfo, SettingControllerApiFactory} from "../../api";
import {useSnackbar} from "notistack";
import {useFormik} from "formik";
import * as yup from "yup";
import SearchIcon from "@mui/icons-material/Search";
import CardMedia from "@mui/material/CardMedia";
import CardContent from "@mui/material/CardContent";
import Card from "@mui/material/Card";
import RssFeedIcon from "@mui/icons-material/RssFeed";

export const FeedsSetting = () => {
  const [file, setFile] = useState<File>();
  const [importing, setImporting] = useState(false);
  const {enqueueSnackbar} = useSnackbar();
  const api = SettingControllerApiFactory();

  function uploadOpml() {
    if (!file) {
      return;
    }
    setImporting(true);
    api.importOpmlUsingPOST(file).then(() => {
      enqueueSnackbar('Import success.', {
        variant: "success",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }).catch((err) => {
      enqueueSnackbar('Import failed. Error: ' + err, {
        variant: "error",
        anchorOrigin: {vertical: "bottom", horizontal: "center"}
      });
    }).finally(() => {
      setImporting(false);
    });
  }

  function handleFileChange(e) {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  }

  const [feedsInfo, setFeedsInfo] = useState<PreviewFeedsInfo>();
  const formikFeeds = useFormik({
    initialValues: {
      subscribeUrl: ''
    },
    validationSchema: yup.object({
      subscribeUrl: yup.string().required('RSS link is required.')
    }),
    onSubmit: (values) => {
      setFeedsInfo(null);
      api.previewFeedsUsingGET(values.subscribeUrl).then((res) => {
        setFeedsInfo(res.data);
      }).catch((err) => {
        enqueueSnackbar('Preview failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      });
    }
  })

  function followFeeds() {
    if (feedsInfo) {
      api.followFeedUsingPOST(feedsInfo?.feedUrl).then(() => {
        enqueueSnackbar('Follow success.', {
          variant: "success",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      }).catch((err) => {
        enqueueSnackbar('Follow failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      });
    }
  }

  return <React.Fragment>
    <div>
      <Typography variant={'h6'}>Feeds</Typography>
      <Divider/>
      <form onSubmit={formikFeeds.handleSubmit}>
        <TextField fullWidth={true} size={'small'} margin={'normal'}
                   label={'RSS link'}
                   id={'subscribeUrl'} name={'subscribeUrl'}
                   value={formikFeeds.values.subscribeUrl}
                   onChange={formikFeeds.handleChange}
                   error={formikFeeds.touched.subscribeUrl && Boolean(formikFeeds.errors.subscribeUrl)}
                   helperText={formikFeeds.touched.subscribeUrl && formikFeeds.errors.subscribeUrl}
                   InputProps={{
                     startAdornment: (
                       <InputAdornment position="start">
                         <SearchIcon/>
                       </InputAdornment>
                     ),
                   }}
        />
        <Button color={'primary'} variant={'contained'} size={'medium'} type={'submit'}>Preview</Button>
      </form>
      <div>
        {feedsInfo && <Card className={`mt-2 flex mr-4`}>
          {
            feedsInfo.siteFaviconUrl &&
            <div className={'w-[130px] flex items-center shrink-0 justify-center'}
                 style={{backgroundColor: 'rgb(247,249,249)'}}>
              <CardMedia
                component="img"
                sx={{width: 60, height: 60}}
                image={feedsInfo.siteFaviconUrl}
                alt={feedsInfo.title}
              />
            </div>
          }
          {
            !feedsInfo.siteFaviconUrl &&
            <div className={'w-[130px] flex items-center shrink-0'} style={{backgroundColor: 'rgb(247,249,249)'}}>
              <CardMedia
                component={RssFeedIcon}
                className={'grow'}
              />
            </div>
          }
          <div className={'flex items-center grow'}>
            <CardContent sx={{borderLeft: '1px solid #ccc'}}>
              <Typography variant="body2" color="text.secondary">
                {feedsInfo.siteLink}
              </Typography>
              <Typography variant="body1" component="div">
                {feedsInfo.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" className={`line-clamp-2`}>
                {feedsInfo.description}
              </Typography>
            </CardContent>
          </div>
          <div className={'flex items-center mr-4'}>
            {
              feedsInfo.subscribed && <>
                <Button color={'info'} variant={'contained'} size={'medium'} disabled={true}>following</Button>
              </>
            }
            {
              !feedsInfo.subscribed &&
              <Button color={'primary'} variant={'contained'} size={'medium'} onClick={followFeeds}>follow</Button>
            }
          </div>
        </Card>}
      </div>
    </div>
    <div className={'mt-6'}>
      <Typography variant={'h6'}>OPML import</Typography>
      <Divider/>
      <form>
        <div className={'pt-3'}>
          <label htmlFor={'opmlFile'}>Choose file: </label>
          <input type={'file'} name={'opmlFile'} onChange={handleFileChange}/>
          <Button type={'button'} color={'primary'} size={'small'} variant={'contained'} disabled={importing}
                  onClick={uploadOpml}>{importing ? 'importing' : 'import'}</Button>
        </div>
      </form>
    </div>
  </React.Fragment>
}