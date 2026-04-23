import React from 'react';
import {
  Box,
  Button,
  Link,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useI18n } from '../i18n';

const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/lcomplete';

export const SponsorSettings: React.FC = () => {
  const { t } = useI18n();

  const paymentMethods = [
    {
      id: 'wechat',
      title: t('sponsor.wechatTitle'),
      description: t('sponsor.wechatDescription'),
      fileName: 'wechat.JPG',
      alt: t('sponsor.wechatAlt'),
    },
    {
      id: 'alipay',
      title: t('sponsor.alipayTitle'),
      description: t('sponsor.alipayDescription'),
      fileName: 'zfb.JPG',
      alt: t('sponsor.alipayAlt'),
    },
  ] as const;

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2 className="section-title">{t('sponsor.title')}</h2>
        <p className="section-description">
          {t('sponsor.description')}
        </p>
      </div>

      <Box className="sponsor-link-card">
        <Typography variant="subtitle1" fontWeight={600}>
          {t('sponsor.githubTitle')}
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
            {t('sponsor.openGithubSponsors')}
          </Button>
        </Box>
      </Box>

      <Box className="sponsor-qrs">
        {paymentMethods.map((paymentMethod) => (
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
