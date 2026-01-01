WITH current_time_info AS (
  SELECT 
    -- Calculate current Pacific Hour
    HOUR(CONVERT_TIMEZONE('UTC', 'America/Los_Angeles', SYSDATE())) AS current_hour_pacific
),

-- Get list of agents currently scheduled for chat from CURRENTLY_ON_CHAT column
currently_on_chat_list AS (
  SELECT DISTINCT
    TRIM(value) AS agent_name
  FROM SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_SCHEDULE_CURRENT s,
  LATERAL FLATTEN(INPUT => SPLIT(s.CURRENTLY_ON_CHAT, ','))
  WHERE CURRENTLY_ON_CHAT IS NOT NULL
    AND TRIM(value) != ''
),

scheduled_tses AS (
  SELECT 
    -- Extract First Name to match Intercom Data
    TRIM(SPLIT_PART(s.TSE, ' ', 1)) AS tse_first_name,
    s.TSE AS tse_full_name,
    CASE (SELECT current_hour_pacific FROM current_time_info)
      WHEN 0 THEN s."_0"
      WHEN 1 THEN s."_1"
      WHEN 2 THEN s."_2"
      WHEN 3 THEN s."_3"
      WHEN 4 THEN s."_4"
      WHEN 5 THEN s."_5"
      WHEN 6 THEN s."_6"
      WHEN 7 THEN s."_7"
      WHEN 8 THEN s."_8"
      WHEN 9 THEN s."_9"
      WHEN 10 THEN s."_10"
      WHEN 11 THEN s."_11"
      WHEN 12 THEN s."_12"
      WHEN 13 THEN s."_13"
      WHEN 14 THEN s."_14"
      WHEN 15 THEN s."_15"
      WHEN 16 THEN s."_16"
      WHEN 17 THEN s."_17"
      WHEN 18 THEN s."_18"
      ELSE 'X' 
    END AS current_hour_status
  FROM SIGMA_ON_SIGMA.SIGMA_WRITABLE.TSE_SCHEDULE_CURRENT s
  WHERE 
    -- Filter out if OOO is 'Yes' (Case insensitive check)
    UPPER(COALESCE(s.OOO, '')) != 'YES'
    -- Only include agents in CURRENTLY_ON_CHAT list
    AND (
      EXISTS (
        SELECT 1 
        FROM currently_on_chat_list coc
        WHERE UPPER(TRIM(s.TSE)) = UPPER(coc.agent_name)
           OR UPPER(TRIM(SPLIT_PART(s.TSE, ' ', 1))) = UPPER(coc.agent_name)
           OR UPPER(coc.agent_name) LIKE '%' || UPPER(TRIM(SPLIT_PART(s.TSE, ' ', 1))) || '%'
      )
    )
    -- Exclude agents with 'X' in current hour block (not working this hour)
    AND CASE (SELECT current_hour_pacific FROM current_time_info)
      WHEN 0 THEN UPPER(COALESCE(s."_0", '')) != 'X'
      WHEN 1 THEN UPPER(COALESCE(s."_1", '')) != 'X'
      WHEN 2 THEN UPPER(COALESCE(s."_2", '')) != 'X'
      WHEN 3 THEN UPPER(COALESCE(s."_3", '')) != 'X'
      WHEN 4 THEN UPPER(COALESCE(s."_4", '')) != 'X'
      WHEN 5 THEN UPPER(COALESCE(s."_5", '')) != 'X'
      WHEN 6 THEN UPPER(COALESCE(s."_6", '')) != 'X'
      WHEN 7 THEN UPPER(COALESCE(s."_7", '')) != 'X'
      WHEN 8 THEN UPPER(COALESCE(s."_8", '')) != 'X'
      WHEN 9 THEN UPPER(COALESCE(s."_9", '')) != 'X'
      WHEN 10 THEN UPPER(COALESCE(s."_10", '')) != 'X'
      WHEN 11 THEN UPPER(COALESCE(s."_11", '')) != 'X'
      WHEN 12 THEN UPPER(COALESCE(s."_12", '')) != 'X'
      WHEN 13 THEN UPPER(COALESCE(s."_13", '')) != 'X'
      WHEN 14 THEN UPPER(COALESCE(s."_14", '')) != 'X'
      WHEN 15 THEN UPPER(COALESCE(s."_15", '')) != 'X'
      WHEN 16 THEN UPPER(COALESCE(s."_16", '')) != 'X'
      WHEN 17 THEN UPPER(COALESCE(s."_17", '')) != 'X'
      WHEN 18 THEN UPPER(COALESCE(s."_18", '')) != 'X'
      ELSE TRUE
    END
)

SELECT 
  st.tse_first_name AS "TSE",
  COALESCE(SUM(CASE WHEN ic.INTERCOM_CHAT_STATUS = 'open' THEN 1 ELSE 0 END), 0) AS "Open Conversations",
  COALESCE(SUM(CASE WHEN ic.INTERCOM_CHAT_STATUS = 'snoozed' THEN 1 ELSE 0 END), 0) AS "Snoozed Conversations"
FROM scheduled_tses st
LEFT JOIN SIGMA_ON_SIGMA.SIGMA_WRITABLE.INTERCOM_CONVERSATIONS_MASTER_TABLE_SQLIVE ic
  ON UPPER(st.tse_first_name) = UPPER(TRIM(ic.TSE_FIRST_NAME))
WHERE 
  -- Only include if status is Y (Chat), F (Focus), L (Lunch), or N (Off Chat)
  -- Note: 'X' is already filtered out above
  st.current_hour_status IN ('Y', 'F', 'L', 'N')
GROUP BY st.tse_first_name
ORDER BY "TSE"
