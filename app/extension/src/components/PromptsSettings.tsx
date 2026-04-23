import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  Snackbar,
  Chip,
  Switch,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Prompt,
  getPromptsSettings,
  savePromptsSettings,
  LANGUAGES,
  LanguageOption,
  getBrowserLanguage,
  findLanguageByEnglish,
} from '../storage';
import { useI18n } from '../i18n';

interface PromptDialogProps {
  open: boolean;
  prompt: Prompt | null;
  onClose: () => void;
  onSave: (name: string, content: string) => void;
}

interface ViewPromptDialogProps {
  open: boolean;
  prompt: Prompt | null;
  onClose: () => void;
}

const ViewPromptDialog: React.FC<ViewPromptDialogProps> = ({
  open,
  prompt,
  onClose,
}) => {
  const { t } = useI18n();

  if (!prompt) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{prompt.name}</DialogTitle>
      <DialogContent>
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            bgcolor: '#f5f5f5',
            p: 2,
            borderRadius: 1,
          }}
        >
          {prompt.content}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

const PromptDialog: React.FC<PromptDialogProps> = ({
  open,
  prompt,
  onClose,
  onSave,
}) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (prompt) {
      setName(prompt.name);
      setContent(prompt.content);
    } else {
      setName('');
      setContent('');
    }
  }, [prompt, open]);

  const handleSave = () => {
    if (name.trim() && content.trim()) {
      onSave(name.trim(), content.trim());
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{prompt ? t('prompts.dialogEditTitle') : t('prompts.dialogAddTitle')}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label={t('prompts.nameLabel')}
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label={t('prompts.contentLabel')}
          fullWidth
          variant="outlined"
          multiline
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          helperText={t('prompts.contentHelper')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || !content.trim()}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const PromptsSettings: React.FC = () => {
  const { t } = useI18n();
  const [defaultTargetLanguage, setDefaultTargetLanguage] = useState('');
  const [savedLanguage, setSavedLanguage] = useState('');  // Track last saved language
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const loadSettings = async () => {
    const settings = await getPromptsSettings();
    // Use browser language as default if not set or empty
    const language = settings.defaultTargetLanguage || getBrowserLanguage();
    setDefaultTargetLanguage(language);
    setSavedLanguage(language);
    setPrompts(settings.prompts);
    setIsInitialized(true);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async (
    language: string,
    promptsList: Prompt[]
  ) => {
    const settings = await getPromptsSettings();
    await savePromptsSettings({
      defaultTargetLanguage: language,
      prompts: promptsList,
      huntlyShortcutsEnabled: settings.huntlyShortcutsEnabled,
    });
    setSnackbarMessage(t('common.settingsSaved'));
    setSnackbarOpen(true);
  };

  const handleDefaultLanguageChange = async (language: string, force = false) => {
    if (!language) return;
    // Skip if language hasn't changed from last saved value (unless forced)
    if (!force && language === savedLanguage) return;

    setDefaultTargetLanguage(language);
    setSavedLanguage(language);
    await saveSettings(language, prompts);
    // Reload settings to get localized system prompts
    const settings = await getPromptsSettings();
    setPrompts(settings.prompts);
  };

  const handlePromptToggle = async (promptId: string, enabled: boolean) => {
    const updatedPrompts = prompts.map((p) =>
      p.id === promptId ? { ...p, enabled, updatedAt: Date.now() } : p
    );
    setPrompts(updatedPrompts);
    await saveSettings(defaultTargetLanguage, updatedPrompts);
  };

  const handleAddPrompt = () => {
    setEditingPrompt(null);
    setDialogOpen(true);
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setDialogOpen(true);
  };

  const handleViewPrompt = (prompt: Prompt) => {
    setViewingPrompt(prompt);
    setViewDialogOpen(true);
  };

  const handleDeletePrompt = async (promptId: string) => {
    const updatedPrompts = prompts.filter((p) => p.id !== promptId);
    setPrompts(updatedPrompts);
    await saveSettings(defaultTargetLanguage, updatedPrompts);
  };

  const handleSavePrompt = async (name: string, content: string) => {
    let updatedPrompts: Prompt[];

    if (editingPrompt) {
      updatedPrompts = prompts.map((p) =>
        p.id === editingPrompt.id
          ? {
              ...p,
              name,
              content,
              updatedAt: Date.now()
            }
          : p
      );
    } else {
      const newPrompt: Prompt = {
        id: `user_prompt_${Date.now()}`,
        name,
        content,
        targetLanguage: defaultTargetLanguage,
        enabled: true,
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updatedPrompts = [...prompts, newPrompt];
    }

    setPrompts(updatedPrompts);
    await saveSettings(defaultTargetLanguage, updatedPrompts);
    setDialogOpen(false);
    setEditingPrompt(null);
  };

  const systemPrompts = prompts.filter((p) => p.isSystem);
  const userPrompts = prompts.filter((p) => !p.isSystem);

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2 className="section-title">{t('prompts.title')}</h2>
        <p className="section-description">{t('prompts.description')}</p>
      </div>

      {/* Default Output Language */}
      <Box sx={{ mt: 3 }}>
        <Autocomplete
          freeSolo
          options={LANGUAGES}
          getOptionLabel={(option) => {
            if (typeof option === 'string') return option;
            return option.english;
          }}
          value={findLanguageByEnglish(defaultTargetLanguage) || null}
          inputValue={defaultTargetLanguage}
          onInputChange={(_, newValue) => {
            if (newValue !== defaultTargetLanguage) {
              setDefaultTargetLanguage(newValue);
            }
          }}
          onChange={(_, newValue) => {
            if (newValue) {
              const language = typeof newValue === 'string' ? newValue : newValue.english;
              handleDefaultLanguageChange(language);
            }
          }}
          onBlur={() => {
            // Save on blur for manual input (compare with last saved value)
            if (defaultTargetLanguage && isInitialized && defaultTargetLanguage !== savedLanguage) {
              handleDefaultLanguageChange(defaultTargetLanguage, true);
            }
          }}
          renderOption={(props, option) => (
            <Box
              component="li"
              {...props}
              key={option.code}
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start !important', py: 1 }}
            >
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {option.english}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                {option.native}
              </Typography>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('prompts.outputLanguageLabel')}
              size="small"
              placeholder={t('prompts.outputLanguagePlaceholder')}
              helperText={t('prompts.outputLanguageHelper')}
            />
          )}
          sx={{ width: '100%' }}
        />
      </Box>

      {/* User Prompts */}
      <Box sx={{ mt: 4 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            {t('prompts.userPromptsTitle')}
          </Typography>
          <Button
            startIcon={<AddIcon />}
            size="small"
            variant="contained"
            onClick={handleAddPrompt}
          >
            {t('common.add')}
          </Button>
        </Box>

        {userPrompts.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography>{t('prompts.emptyTitle')}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {t('prompts.emptyDescription')}
            </Typography>
          </Paper>
        ) : (
          <Paper variant="outlined">
            <List disablePadding>
              {userPrompts.map((prompt, index) => (
                <React.Fragment key={prompt.id}>
                  {index > 0 && <Divider />}
                  <ListItem sx={{ py: 1.5 }}>
                    <Switch
                      checked={prompt.enabled}
                      onChange={(e) => handlePromptToggle(prompt.id, e.target.checked)}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Tooltip
                      title={
                        <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                          {prompt.content}
                        </Typography>
                      }
                      placement="top-start"
                      arrow
                      enterDelay={500}
                      slotProps={{
                        tooltip: {
                          sx: { maxWidth: 500, p: 1.5 }
                        }
                      }}
                    >
                      <ListItemText
                        primary={prompt.name}
                        secondary={
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '450px',
                            }}
                          >
                            {prompt.content}
                          </Typography>
                        }
                      />
                    </Tooltip>
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleEditPrompt(prompt)}
                        sx={{ mr: 0.5 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleDeletePrompt(prompt.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Paper>
        )}
      </Box>

      {/* System Prompts */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('prompts.systemPromptsTitle')}
          </Typography>
          <Chip
            icon={<LockIcon sx={{ fontSize: 14 }} />}
            label={t('common.builtIn')}
            size="small"
            variant="outlined"
            color="default"
          />
        </Box>

        <Paper variant="outlined">
          <List disablePadding>
            {systemPrompts.map((prompt, index) => (
              <React.Fragment key={prompt.id}>
                {index > 0 && <Divider />}
                <ListItem sx={{ py: 1.5 }}>
                  <Switch
                    checked={prompt.enabled}
                    onChange={(e) => handlePromptToggle(prompt.id, e.target.checked)}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Tooltip
                    title={
                      <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                        {prompt.content}
                      </Typography>
                    }
                    placement="top-start"
                    arrow
                    enterDelay={500}
                    slotProps={{
                      tooltip: {
                        sx: { maxWidth: 500, p: 1.5 }
                      }
                    }}
                  >
                    <ListItemText
                      primary={prompt.name}
                      secondary={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '450px',
                          }}
                        >
                          {prompt.content}
                        </Typography>
                      }
                    />
                  </Tooltip>
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleViewPrompt(prompt)}
                      title={t('common.view')}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      </Box>

      <PromptDialog
        open={dialogOpen}
        prompt={editingPrompt}
        onClose={() => {
          setDialogOpen(false);
          setEditingPrompt(null);
        }}
        onSave={handleSavePrompt}
      />

      <ViewPromptDialog
        open={viewDialogOpen}
        prompt={viewingPrompt}
        onClose={() => {
          setViewDialogOpen(false);
          setViewingPrompt(null);
        }}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  );
};
