import React from 'react';
import {
  Box,
  Button,
  Link,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/lcomplete';

const PAYMENT_METHODS = [
  {
    id: 'wechat',
    title: 'WeChat Pay',
    description: 'Scan to support Huntly with WeChat.',
    fileName: 'wechat.JPG',
    alt: 'WeChat Pay QR code',
  },
  {
    id: 'alipay',
    title: 'Alipay',
    description: 'Scan to support Huntly with Alipay.',
    fileName: 'zfb.JPG',
    alt: 'Alipay QR code',
  },
] as const;

export const SponsorSettings: React.FC = () => {
  return (
    <div className="settings-section">
      <div className="section-header">
        <h2 className="section-title">Sponsor Huntly</h2>
        <p className="section-description">
          If you find it useful, please consider supporting its development.
        </p>
      </div>

      <Box className="sponsor-link-card">
        <Typography variant="subtitle1" fontWeight={600}>
          GitHub Sponsors
        </Typography>
        <Link
          href={GITHUB_SPONSORS_URL}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          className="sponsor-link-url"
        >
          {GITHUB_SPONSORS_URL}
        </Link>
        <Box>
          <Button
            variant="contained"
            component="a"
            href={GITHUB_SPONSORS_URL}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon />}
          >
            Open GitHub Sponsors
          </Button>
        </Box>
      </Box>

      <Box className="sponsor-qrs">
        {PAYMENT_METHODS.map((paymentMethod) => (
          <Box key={paymentMethod.id} className="sponsor-qr-card">
            <Typography variant="subtitle1" fontWeight={600}>
              {paymentMethod.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {paymentMethod.description}
            </Typography>
            <Box
              component="img"
              src={chrome.runtime.getURL(paymentMethod.fileName)}
              alt={paymentMethod.alt}
              className="sponsor-qr-image"
            />
          </Box>
        ))}
      </Box>
    </div>
  );
};
