export const BingoQueries = {
  setCreate: `
    INSERT INTO tb_bingo (seq, no1, no2, no3, no4, no5, no6, no7)
    VALUES (@seq, @no1, @no2, @no3, @no4, @no5, @no6, @no7)
  `,
  getOne: `
    SELECT seq, no1, no2, no3, no4, no5, no6, no7, created_at
    FROM tb_bingo
    WHERE seq = @seq
  `,
  getList: `
    SELECT seq, no1, no2, no3, no4, no5, no6, no7, created_at
    FROM tb_bingo
    ORDER BY seq DESC
    LIMIT @limit OFFSET @offset
  `,
  getCount: `SELECT COUNT(*) AS cnt FROM tb_bingo`,
  setUpdate: `
    UPDATE tb_bingo
    SET no1=@no1, no2=@no2, no3=@no3, no4=@no4, no5=@no5, no6=@no6, no7=@no7
    WHERE seq=@seq
  `,
  setDelete: `DELETE FROM tb_bingo WHERE seq=@seq`,
  getRecent: `
    SELECT seq, no1, no2, no3, no4, no5, no6, no7, created_at
    FROM tb_bingo
    ORDER BY seq DESC
    LIMIT @rounds
  `
};
