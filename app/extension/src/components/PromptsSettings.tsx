import React, { useEffect, useState } from 'react';
import {
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Chip,
  Switch,
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
} from '../storage';

const COMMON_LANGUAGES = [
  'Chinese',
  'English',
  'Japanese',
  'Korean',
  'Spanish',
  'French',
  'German',
  'Russian',
  'Portuguese',
  'Italian',
  'Arabic',
];

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
        <Button onClick={onClose}>Close</Button>
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
      <DialogTitle>{prompt ? 'Edit Prompt' : 'Add Prompt'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Name"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label="Content"
          fullWidth
          variant="outlined"
          multiline
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          helperText="Use {lang} as a placeholder for the target language"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || !content.trim()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const PromptsSettings: React.FC = () => {
  const [defaultTargetLanguage, setDefaultTargetLanguage] = useState('Chinese');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const loadSettings = async () => {
    const settings = await getPromptsSettings();
    setDefaultTargetLanguage(settings.defaultTargetLanguage);
    setPrompts(settings.prompts);
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
    setSnackbarMessage('Settings saved');
    setSnackbarOpen(true);
  };

  const handleDefaultLanguageChange = async (language: string) => {
    setDefaultTargetLanguage(language);
    await saveSettings(language, prompts);
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
        <h2 className="section-title">Prompts</h2>
        <p className="section-description">
          Configure prompts for AI processing. Use{' '}
          <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
            {'{lang}'}
          </code>{' '}
          in prompt content as a placeholder for the target language.
        </p>
      </div>

      {/* Default Target Language */}
      <Box sx={{ mt: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel id="default-language-label">Default Target Language</InputLabel>
          <Select
            labelId="default-language-label"
            value={defaultTargetLanguage}
            label="Default Target Language"
            onChange={(e) => handleDefaultLanguageChange(e.target.value)}
          >
            {COMMON_LANGUAGES.map((lang) => (
              <MenuItem key={lang} value={lang}>
                {lang}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
            Prompts
          </Typography>
          <Button
            startIcon={<AddIcon />}
            size="small"
            variant="contained"
            onClick={handleAddPrompt}
          >
            Add
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
            <Typography>No prompts yet</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Click &quot;Add&quot; to create your own prompt
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
                            maxWidth: '400px',
                          }}
                        >
                          {prompt.content}
                        </Typography>
                      }
                    />
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
            System Prompts
          </Typography>
          <Chip
            icon={<LockIcon sx={{ fontSize: 14 }} />}
            label="Built-in"
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
                          maxWidth: '400px',
                        }}
                      >
                        {prompt.content}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleViewPrompt(prompt)}
                      title="View"
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
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </div>
  );
};
