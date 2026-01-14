import MainContainer from "../../components/MainContainer";
import McpSetting from "../../components/SettingModal/McpSetting";

const SettingsMcp = () => {
    return (
        <MainContainer>
            <div className="settings-page-content p-4 max-w-4xl">
                <McpSetting />
            </div>
        </MainContainer>
    );
};

export default SettingsMcp;
