export const BingoQueries = {
  insert: `
    INSERT INTO tb_bingo (seq, no1, no2, no3, no4, no5, no6, no7)
    VALUES (@seq, @no1, @no2, @no3, @no4, @no5, @no6, @no7)
  `,
  getBySeq: `
    SELECT seq, no1, no2, no3, no4, no5, no6, no7, created_at
    FROM tb_bingo
    WHERE seq = @seq
  `,
  listPaged: `
    SELECT seq, no1, no2, no3, no4, no5, no6, no7, created_at
    FROM tb_bingo
    ORDER BY seq DESC
    LIMIT @limit OFFSET @offset
  `,
  countAll: `SELECT COUNT(*) AS cnt FROM tb_bingo`,
  updateBySeq: `
    UPDATE tb_bingo
    SET no1=@no1, no2=@no2, no3=@no3, no4=@no4, no5=@no5, no6=@no6, no7=@no7
    WHERE seq=@seq
  `,
  deleteBySeq: `DELETE FROM tb_bingo WHERE seq=@seq`,
  recentHistory: `
    SELECT seq, no1, no2, no3, no4, no5, no6, no7, created_at
    FROM tb_bingo
    ORDER BY seq DESC
    LIMIT @rounds
  `
};
