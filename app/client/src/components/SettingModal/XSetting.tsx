import {
  TextField,
  Typography,
  Box,
  alpha,
  Alert,
} from "@mui/material";
import React, { useState, useRef } from "react";
import { SettingControllerApiFactory } from "../../api";
import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import SettingSectionTitle from "./SettingSectionTitle";
import { TwitterSaveRulesSetting } from "./TwitterSaveRulesSetting";

export const XSetting: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();
  const [minLikes, setMinLikes] = useState<number>(0);
  const [minLikesLoading, setMinLikesLoading] = useState(true);
  const originalMinLikesRef = useRef<number>(0);

  // Fetch global setting for min likes
  const { data: globalSetting, refetch: refetchGlobalSetting } = useQuery(
    ["global_setting_for_x"],
    async () => {
      const result = await api.getGlobalSettingUsingGET();
      return result.data;
    },
    {
      onSuccess: (data) => {
        const value = data?.autoSaveTweetMinLikes ?? 0;
        setMinLikes(value);
        originalMinLikesRef.current = value;
        setMinLikesLoading(false);
      },
      onError: () => {
        setMinLikesLoading(false);
      }
    }
  );

  const handleMinLikesSave = async () => {
    // Only save if value has changed
    if (minLikes === originalMinLikesRef.current) {
      return;
    }
    if (!globalSetting) return;
    try {
      await api.saveGlobalSettingUsingPOST({
        ...globalSetting,
        autoSaveTweetMinLikes: minLikes,
      });
      originalMinLikesRef.current = minLikes;
      enqueueSnackbar('Minimum likes setting saved.', {
        variant: 'success',
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' }
      });
      refetchGlobalSetting();
    } catch (err) {
      enqueueSnackbar('Failed to save minimum likes setting.', {
        variant: 'error',
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' }
      });
    }
  };

  return (
    <div>
      <SettingSectionTitle
        first
        icon={FilterAltIcon}
        description="Filter tweets by minimum likes before saving."
      >
        Global Filter
      </SettingSectionTitle>

      <Box sx={{ mt: 2 }}>
        <Box sx={{
          p: 2.5,
          borderRadius: 2,
          bgcolor: alpha('#3b82f6', 0.03),
          border: '1px solid',
          borderColor: alpha('#3b82f6', 0.1),
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <TextField
              type="number"
              size="small"
              label="Minimum likes"
              value={minLikes}
              onChange={(e) => setMinLikes(Math.max(0, parseInt(e.target.value) || 0))}
              onBlur={handleMinLikesSave}
              inputProps={{ min: 0, max: 100000 }}
              disabled={minLikesLoading}
              sx={{ width: 180 }}
            />
            <Alert severity="info" sx={{ flex: 1, py: 0.5 }}>
              <Typography variant="body2">
                Only save tweets with at least this many likes. Set to 0 to save all tweets.
                This filter applies globally and does not affect user-specific rules.
              </Typography>
            </Alert>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: 4 }}>
        <TwitterSaveRulesSetting />
      </Box>
    </div>
  );
};

export default XSetting;

