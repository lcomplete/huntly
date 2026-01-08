import { Box, Typography } from "@mui/material";

type SyncSettingsProps = {
  allowLocalServer: boolean;
};

export default function SyncSettings({
  allowLocalServer,
}: SyncSettingsProps) {
  const scopeLabel = allowLocalServer ? "local or remote" : "remote";

  return (
    <Box className="p-4">
      <Typography variant="h6" className="mb-2">
        Markdown Sync
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Markdown sync is disabled. Use the server API or manual export for {scopeLabel} content.
      </Typography>
    </Box>
  );
}
