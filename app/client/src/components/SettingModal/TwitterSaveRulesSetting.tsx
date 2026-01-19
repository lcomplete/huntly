import {
  Button,
  Divider,
  FormControl,
  InputAdornment, MenuItem,
  Select,
  TextField,
  IconButton,
  Typography,
  Box,
  Chip,
  Tooltip,
  alpha,
} from "@mui/material";
import React, { useState } from "react";
import { SettingControllerApiFactory } from "../../api";
import { useSnackbar } from "notistack";
import { Formik, Form, FieldArray, getIn } from 'formik';
import * as yup from 'yup';
import { useQuery } from "@tanstack/react-query";
import DeleteIcon from "@mui/icons-material/Delete";
import RuleIcon from "@mui/icons-material/Rule";
import AddIcon from "@mui/icons-material/Add";
import PersonIcon from "@mui/icons-material/Person";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import TwitterIcon from "@mui/icons-material/Twitter";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SettingSectionTitle from "./SettingSectionTitle";
import { CollectionApi, CollectionTreeVO, CollectionVO } from "../../api/collectionApi";
import CollectionPickerDialog from "../Dialogs/CollectionPickerDialog";

// Helper to find collection name by id from tree data
const findCollectionName = (treeData: CollectionTreeVO | null, collectionId: number | null | undefined): string | null => {
  if (!treeData || !collectionId) return null;

  const searchInCollections = (collections: CollectionVO[]): string | null => {
    for (const coll of collections) {
      if (coll.id === collectionId) return coll.name;
      if (coll.children && coll.children.length > 0) {
        const found = searchInCollections(coll.children);
        if (found) return found;
      }
    }
    return null;
  };

  for (const group of treeData.groups) {
    const found = searchInCollections(group.collections);
    if (found) return found;
  }
  return null;
};

// Collection selector component
interface CollectionSelectorProps {
  value: number | null | undefined;
  onChange: (collectionId: number | null) => void;
  treeData: CollectionTreeVO | null;
  label: string;
  themeColor?: string;
}

const CollectionSelector: React.FC<CollectionSelectorProps> = ({ value, onChange, treeData, label, themeColor = '#3b82f6' }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const collectionName = findCollectionName(treeData, value);

  return (
    <>
      <Button
        variant="text"
        onClick={() => setDialogOpen(true)}
        startIcon={<FolderOutlinedIcon sx={{ fontSize: 18, color: value ? themeColor : '#94a3b8' }} />}
        endIcon={value && collectionName ? (
          <Box
            component="span"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              ml: 0.5,
              p: 0.25,
              borderRadius: 0.5,
              '&:hover': { bgcolor: alpha('#ef4444', 0.1) }
            }}
          >
            <DeleteIcon sx={{ fontSize: 14, color: '#94a3b8', '&:hover': { color: '#ef4444' } }} />
          </Box>
        ) : (
          <AddIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
        )}
        sx={getCollectionButtonStyles(!!value, themeColor)}
      >
        <Box sx={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
          {value && collectionName ? (
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {collectionName}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
              Select collection...
            </Typography>
          )}
        </Box>
      </Button>
      <CollectionPickerDialog
        open={dialogOpen}
        currentCollectionId={value ?? null}
        onClose={() => setDialogOpen(false)}
        onSelect={(collectionId) => onChange(collectionId)}
      />
    </>
  );
};

// Rule card styles
const ruleCardStyles = {
  position: 'relative',
  borderRadius: 3,
  border: '1px solid',
  borderColor: '#e2e8f0',
  bgcolor: '#fff',
  overflow: 'hidden',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    borderColor: '#cbd5e1',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
  }
};

// Save rule box styles for each category
const getSaveRuleBoxStyles = (color: string) => ({
  p: 2,
  borderRadius: 2,
  bgcolor: alpha(color, 0.03),
  border: '1px solid',
  borderColor: alpha(color, 0.1),
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
});

// Collection button styles - more prominent
const getCollectionButtonStyles = (hasValue: boolean, color: string) => ({
  width: '100%',
  justifyContent: 'flex-start',
  textTransform: 'none',
  borderRadius: 1.5,
  py: 1,
  px: 1.5,
  transition: 'all 0.15s ease-in-out',
  ...(hasValue ? {
    bgcolor: alpha(color, 0.08),
    border: '1px solid',
    borderColor: alpha(color, 0.25),
    color: '#334155',
    '&:hover': {
      bgcolor: alpha(color, 0.12),
      borderColor: alpha(color, 0.4),
    }
  } : {
    bgcolor: '#fff',
    border: '2px dashed',
    borderColor: alpha(color, 0.3),
    color: '#64748b',
    '&:hover': {
      bgcolor: alpha(color, 0.04),
      borderColor: color,
      color: '#334155',
    }
  })
});

export const TwitterSaveRulesSetting = () => {
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();

  const {
    data: twitterSettings,
    refetch: refetchTwitterSettings,
  } = useQuery(["twitter_settings"], async () => (await api.getTwitterUserSettingsUsingGET()).data);

  // Fetch collection tree for collection selection
  const { data: collectionTree } = useQuery(
    ["collection_tree_for_settings"],
    async () => await CollectionApi.getTree()
  );

  const twitterSettingsValidation = yup.object().shape({
    settings: yup.array().of(yup.object().shape({
      name: yup.string().required('Name is required.'),
      screenName: yup.string().required('Screen name is required.'),
      myself: yup.boolean().nullable(),
      tweetToLibraryType: yup.number().nullable(),
      bookmarkToLibraryType: yup.number().nullable(),
      likeToLibraryType: yup.number().nullable(),
      tweetToCollectionId: yup.number().nullable(),
      bookmarkToCollectionId: yup.number().nullable(),
      likeToCollectionId: yup.number().nullable(),
    }))
  });

  return (
    <div>
      <SettingSectionTitle
        first
        icon={RuleIcon}
        description="Configure automatic saving rules for Twitter users' tweets, bookmarks, and likes."
      >
        Twitter Save Rules
      </SettingSectionTitle>

      {twitterSettings && (
        <Formik
          initialValues={{
            settings: !twitterSettings || twitterSettings.length === 0
              ? [{ id: null, name: "", screenName: "" }]
              : twitterSettings
          }}
          validationSchema={twitterSettingsValidation}
          onSubmit={values => {
            api.saveTwitterUserSettingsUsingPOST(values.settings).then(() => {
              enqueueSnackbar(`Twitter settings saved successfully.`, {
                variant: "success",
                anchorOrigin: { vertical: "bottom", horizontal: "center" }
              });
            }).catch((err) => {
              enqueueSnackbar('Failed to save Twitter settings. Error: ' + err, {
                variant: "error",
                anchorOrigin: { vertical: "bottom", horizontal: "center" }
              });
            }).finally(() => {
              refetchTwitterSettings();
            });
          }}
        >
          {({ values, touched, errors, handleChange, handleBlur, setFieldValue }) => (
            <Form noValidate autoComplete="off">
              <FieldArray name="settings">
                {({ push, remove }) => (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 3 }}>
                    {values.settings.map((setting, index) => {
                      const name = `settings[${index}].name`;
                      const touchedName = getIn(touched, name);
                      const errorName = getIn(errors, name);

                      const screenName = `settings[${index}].screenName`;
                      const touchedScreenName = getIn(touched, screenName);
                      const errorScreenName = getIn(errors, screenName);

                      const tweetToLibraryType = `settings[${index}].tweetToLibraryType`;
                      const bookmarkToLibraryType = `settings[${index}].bookmarkToLibraryType`;
                      const likeToLibraryType = `settings[${index}].likeToLibraryType`;
                      const tweetToCollectionId = `settings[${index}].tweetToCollectionId`;
                      const bookmarkToCollectionId = `settings[${index}].bookmarkToCollectionId`;
                      const likeToCollectionId = `settings[${index}].likeToCollectionId`;
                      const myself = `settings[${index}].myself`;

                      return (
                        <Box key={index} sx={ruleCardStyles}>
                          <Box sx={{ p: 2.5 }}>
                            {/* Header: User info and actions */}
                            <Box sx={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'flex-start',
                              gap: 2,
                              mb: 2.5
                            }}>
                              <TextField
                                size="small"
                                variant="outlined"
                                label="Display Name"
                                name={name}
                                value={setting.name}
                                sx={{
                                  width: { xs: '100%', sm: 180 },
                                  '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.5,
                                    bgcolor: '#f8fafc',
                                    '&:hover': { bgcolor: '#f1f5f9' },
                                    '&.Mui-focused': { bgcolor: '#fff' }
                                  }
                                }}
                                required
                                helperText={touchedName && errorName ? errorName : ""}
                                error={Boolean(touchedName && errorName)}
                                onChange={handleChange}
                                onBlur={handleBlur}
                              />
                              <TextField
                                size="small"
                                variant="outlined"
                                label="Screen Name"
                                name={screenName}
                                value={setting.screenName}
                                sx={{
                                  width: { xs: '100%', sm: 180 },
                                  '& .MuiOutlinedInput-root': {
                                    borderRadius: 1.5,
                                    bgcolor: '#f8fafc',
                                    '&:hover': { bgcolor: '#f1f5f9' },
                                    '&.Mui-focused': { bgcolor: '#fff' }
                                  }
                                }}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <Typography sx={{ color: '#94a3b8', fontWeight: 500 }}>@</Typography>
                                    </InputAdornment>
                                  ),
                                }}
                                required
                                helperText={touchedScreenName && errorScreenName ? errorScreenName : ""}
                                error={Boolean(touchedScreenName && errorScreenName)}
                                onChange={handleChange}
                                onBlur={handleBlur}
                              />
                              <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mt: { xs: 0, sm: 0.5 },
                                ml: 'auto'
                              }}>
                                <Tooltip
                                  title={setting.myself ? "This is your own Twitter account" : "Mark as my own account (to sync your tweets, bookmarks, and likes)"}
                                  arrow
                                  placement="top"
                                >
                                  <Chip
                                    icon={<PersonIcon sx={{ fontSize: 16 }} />}
                                    label={setting.myself ? "My Account" : "Set as Mine"}
                                    size="small"
                                    onClick={() => setFieldValue(myself, !setting.myself)}
                                    sx={{
                                      cursor: 'pointer',
                                      height: 28,
                                      fontWeight: 500,
                                      fontSize: '0.75rem',
                                      transition: 'all 0.15s ease-in-out',
                                      ...(setting.myself ? {
                                        bgcolor: '#3b82f6',
                                        color: '#fff',
                                        '& .MuiChip-icon': { color: '#fff' },
                                        '&:hover': {
                                          bgcolor: '#2563eb',
                                        }
                                      } : {
                                        bgcolor: '#f1f5f9',
                                        color: '#64748b',
                                        border: '1px dashed #cbd5e1',
                                        '& .MuiChip-icon': { color: '#94a3b8' },
                                        '&:hover': {
                                          bgcolor: '#e2e8f0',
                                          borderColor: '#94a3b8',
                                        }
                                      })
                                    }}
                                  />
                                </Tooltip>
                                <Tooltip title="Remove this rule" arrow placement="top">
                                  <IconButton
                                    size="small"
                                    onClick={() => remove(index)}
                                    sx={{
                                      color: '#94a3b8',
                                      '&:hover': {
                                        color: '#ef4444',
                                        bgcolor: alpha('#ef4444', 0.08)
                                      }
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>

                            <Divider sx={{ mb: 2.5, borderColor: '#e2e8f0' }} />

                            {/* Save Rules Grid */}
                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                              gap: 2
                            }}>
                              {/* Tweets */}
                              <Box sx={getSaveRuleBoxStyles('#1d9bf0')}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <TwitterIcon sx={{ fontSize: 18, color: '#1d9bf0' }} />
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                    Tweets
                                  </Typography>
                                </Box>
                                <CollectionSelector
                                  value={setting.tweetToCollectionId}
                                  onChange={(v) => setFieldValue(tweetToCollectionId, v)}
                                  treeData={collectionTree ?? null}
                                  label="Collection"
                                  themeColor="#1d9bf0"
                                />
                                <FormControl size="small" fullWidth>
                                  <Select
                                    name={tweetToLibraryType}
                                    value={setting.tweetToLibraryType || 0}
                                    onChange={handleChange}
                                    size="small"
                                    displayEmpty
                                    sx={{
                                      borderRadius: 1.5,
                                      bgcolor: '#fff',
                                      fontSize: '0.8125rem',
                                      color: setting.tweetToLibraryType ? '#334155' : '#94a3b8',
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#e2e8f0'
                                      },
                                      '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#cbd5e1'
                                      }
                                    }}
                                  >
                                    <MenuItem value={0} sx={{ color: '#94a3b8', fontStyle: 'italic' }}>Library status (optional)</MenuItem>
                                    <MenuItem value={1}>My list</MenuItem>
                                    <MenuItem value={2}>Starred</MenuItem>
                                    <MenuItem value={3}>Read later</MenuItem>
                                    <MenuItem value={4}>Archive</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>

                              {/* Bookmarks */}
                              <Box sx={getSaveRuleBoxStyles('#f59e0b')}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <BookmarkIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                    Bookmarks
                                  </Typography>
                                </Box>
                                <CollectionSelector
                                  value={setting.bookmarkToCollectionId}
                                  onChange={(v) => setFieldValue(bookmarkToCollectionId, v)}
                                  treeData={collectionTree ?? null}
                                  label="Collection"
                                  themeColor="#f59e0b"
                                />
                                <FormControl size="small" fullWidth>
                                  <Select
                                    name={bookmarkToLibraryType}
                                    value={setting.bookmarkToLibraryType || 0}
                                    onChange={handleChange}
                                    size="small"
                                    displayEmpty
                                    sx={{
                                      borderRadius: 1.5,
                                      bgcolor: '#fff',
                                      fontSize: '0.8125rem',
                                      color: setting.bookmarkToLibraryType ? '#334155' : '#94a3b8',
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#e2e8f0'
                                      },
                                      '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#cbd5e1'
                                      }
                                    }}
                                  >
                                    <MenuItem value={0} sx={{ color: '#94a3b8', fontStyle: 'italic' }}>Library status (optional)</MenuItem>
                                    <MenuItem value={1}>My list</MenuItem>
                                    <MenuItem value={2}>Starred</MenuItem>
                                    <MenuItem value={3}>Read later</MenuItem>
                                    <MenuItem value={4}>Archive</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>

                              {/* Likes */}
                              <Box sx={getSaveRuleBoxStyles('#ef4444')}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <FavoriteIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                    Likes
                                  </Typography>
                                </Box>
                                <CollectionSelector
                                  value={setting.likeToCollectionId}
                                  onChange={(v) => setFieldValue(likeToCollectionId, v)}
                                  treeData={collectionTree ?? null}
                                  label="Collection"
                                  themeColor="#ef4444"
                                />
                                <FormControl size="small" fullWidth>
                                  <Select
                                    name={likeToLibraryType}
                                    value={setting.likeToLibraryType || 0}
                                    onChange={handleChange}
                                    size="small"
                                    displayEmpty
                                    sx={{
                                      borderRadius: 1.5,
                                      bgcolor: '#fff',
                                      fontSize: '0.8125rem',
                                      color: setting.likeToLibraryType ? '#334155' : '#94a3b8',
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#e2e8f0'
                                      },
                                      '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#cbd5e1'
                                      }
                                    }}
                                  >
                                    <MenuItem value={0} sx={{ color: '#94a3b8', fontStyle: 'italic' }}>Library status (optional)</MenuItem>
                                    <MenuItem value={1}>My list</MenuItem>
                                    <MenuItem value={2}>Starred</MenuItem>
                                    <MenuItem value={3}>Read later</MenuItem>
                                    <MenuItem value={4}>Archive</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}

                    {/* Add Rule Button */}
                    <Button
                      type="button"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => push({ id: null, name: "", screenName: "" })}
                      sx={{
                        alignSelf: 'flex-start',
                        borderRadius: 2,
                        borderColor: '#e2e8f0',
                        color: '#64748b',
                        textTransform: 'none',
                        fontWeight: 500,
                        px: 2.5,
                        py: 1,
                        '&:hover': {
                          borderColor: '#3b82f6',
                          color: '#3b82f6',
                          bgcolor: alpha('#3b82f6', 0.04)
                        }
                      }}
                    >
                      Add Twitter User Rule
                    </Button>
                  </Box>
                )}
              </FieldArray>

              {/* Save Button */}
              <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e2e8f0' }}>
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 4,
                    py: 1,
                    boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
                    }
                  }}
                >
                  Save Settings
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      )}
    </div>
  );
}

