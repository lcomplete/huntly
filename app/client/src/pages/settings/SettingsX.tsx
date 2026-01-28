import MainContainer from "../../components/MainContainer";
import XSetting from "../../components/SettingModal/XSetting";
import SubHeader from "../../components/SubHeader";
import SvgIcon, { SvgIconProps } from "@mui/material/SvgIcon";
import "../../styles/settings.css";

// X (Twitter) Icon Component - same as in PrimaryNavigation
function XIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </SvgIcon>
  );
}

const SettingsX = () => {
  return (
    <MainContainer>
      <SubHeader
        navLabel={{ labelText: 'X', labelIcon: XIcon }}
        buttonOptions={{ markRead: false }}
      />
      <div className="settings-page-content p-6 max-w-4xl">
        <div className="settings-card">
          <XSetting />
        </div>
      </div>
    </MainContainer>
  );
};

export default SettingsX;

