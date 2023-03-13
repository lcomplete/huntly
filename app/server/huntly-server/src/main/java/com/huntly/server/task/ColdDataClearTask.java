package com.huntly.server.task;

import com.huntly.server.domain.constant.AppConstants;
import com.huntly.server.domain.entity.GlobalSetting;
import com.huntly.server.service.GlobalSettingService;
import com.huntly.server.service.PageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
@Slf4j
public class ColdDataClearTask {
    private final GlobalSettingService settingService;

    private final PageService pageService;

    public ColdDataClearTask(GlobalSettingService settingService, PageService pageService) {
        this.settingService = settingService;
        this.pageService = pageService;
    }

    @Scheduled(initialDelay = 1000 * 10, fixedRate = 1000 * 60)
    public void autoClearColdData() {
        log.info("auto clear cold data");
        GlobalSetting setting = settingService.getGlobalSetting();
        int coldDataKeepDays = setting != null && setting.getColdDataKeepDays() != null && setting.getColdDataKeepDays() > 0
                ? setting.getColdDataKeepDays() : AppConstants.DEFAULT_COLD_DATA_KEEP_DAYS;
        Instant coldDataUpdateBefore = Instant.now().minus(coldDataKeepDays, ChronoUnit.DAYS);

        List<Long> coldPageIds = pageService.getColdDataPageIds(coldDataUpdateBefore, 200);
        for (Long pageId : coldPageIds) {
            pageService.delete(pageId);
        }
        log.info("cold data size: {}", coldPageIds.size());
    }
}
