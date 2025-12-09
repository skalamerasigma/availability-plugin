-- Create a unified schedule view that automatically selects the right schedule based on day of week
-- Run this in Snowflake to create a single view the plugin can connect to

CREATE OR REPLACE VIEW SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_SCHEDULE_CURRENT AS
SELECT *
FROM (
    -- Monday (DOW = 1) and Wednesday (DOW = 3) -> Mon/Wed schedule
    SELECT * FROM SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_HOURLY_BLOCKS_SCHEDULE_MON_WED
    WHERE DAYOFWEEK(CURRENT_DATE()) IN (1, 3)
    
    UNION ALL
    
    -- Tuesday (DOW = 2) and Thursday (DOW = 4) -> Tue/Thu schedule  
    SELECT * FROM SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_HOURLY_BLOCKS_SCHEDULE_TUE_TH
    WHERE DAYOFWEEK(CURRENT_DATE()) IN (2, 4)
    
    UNION ALL
    
    -- Friday (DOW = 5) -> Friday schedule
    SELECT * FROM SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_HOURLY_BLOCKS_SCHEDULE_FRIDAY
    WHERE DAYOFWEEK(CURRENT_DATE()) = 5
    
    UNION ALL
    
    -- Weekend (DOW = 0 or 6) -> Show Friday schedule as fallback (everyone will show as X/off)
    SELECT * FROM SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_HOURLY_BLOCKS_SCHEDULE_FRIDAY
    WHERE DAYOFWEEK(CURRENT_DATE()) IN (0, 6)
);

-- Grant access if needed
-- GRANT SELECT ON SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_SCHEDULE_CURRENT TO ROLE <your_role>;

-- To test:
-- SELECT * FROM SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_SCHEDULE_CURRENT;

