* Mantis EE-02 S1/S2/Q1 behavioral screening model.
* Issue 24. UNVERIFIED envelopes. ngspice screens; it does not qualify.
* P08/UID/I2C/firmware are not in the Q1 enable path.
* Raw MIPI is not on B27/B50.
*
* Decks must supply: V_VIN, S1/S2/contact PWLs, and fault sources.

.param v_in=12 i_lim=1 v_uvlo=8 v_safe=1
.param r_contact=0.05 r_fuse=0.02 r_on_q1=0.05
.param c_load=47u r_load=24 r_discharge=10
.param r_sense=1m

.model SWL sw vt=1.5 vh=0.4 ron=0.05 roff=100meg
.model SWC sw vt=1.5 vh=0.4 ron={r_contact} roff=100meg
.model SWQ sw vt=1.5 vh=0.4 ron={r_on_q1} roff=100meg
.model SWD sw vt=1.5 vh=0.4 ron={r_discharge} roff=100meg
.model SWS sw vt=1.5 vh=0.4 ron=1m roff=100meg
.model dclamp d n=1

V_VREF vref 0 DC 3.3

* F1 + P01/P02 VIN share, P03/P04 return. Ground-first is a PWL duty of the deck.
R_F1 vin_src vin_fused {r_fuse}
S_P01 vin_fused vin_shared p01_make 0 SWC
S_P02 vin_fused vin_shared p02_make 0 SWC
S_P03 gnd_shared 0 p03_make 0 SWC
S_P04 gnd_shared 0 p04_make 0 SWC
R_GNDREF gnd_shared 0 1meg
S_C01 vin_shared vin_b50 b50_vin_make 0 SWC
S_C03 gnd_shared 0 b50_gnd_make 0 SWC
R_B50 vin_b50 0 1meg

* Hardware AND: vref --S1(NO)-- n_s1_mid --S2(NO)-- interlock_ok
S_S1 n_s1_mid vref s1_ctrl 0 SWL
S_S2 interlock_ok n_s1_mid s2_ctrl 0 SWL
R_INTPD interlock_ok 0 10k

* Remate request holds after a mate is broken until B27 or B50 VIN contacts
* actually open (or both S1 and S2 open). Interrupted pinch cannot re-enable.
B_BOTH_CL both_cl 0 V=u(V(s1_ctrl)-1.5)*u(V(s2_ctrl)-1.5)*3.3
B_BOTH_OPEN both_open 0 V=u(1.5-V(s1_ctrl))*u(1.5-V(s2_ctrl))*3.3
B_B27_OPEN b27_open 0 V=u(1.5-V(p01_make))*u(1.5-V(p02_make))*3.3
B_B50_OPEN b50_open 0 V=u(1.5-V(b50_vin_make))*u(1.5-V(b50_gnd_make))*3.3
B_BEEN 0 been_cap I=u(V(both_cl)-1.5)*2m
B_BEENCLR been_cap 0 I=(u(V(b27_open)-1.5)+u(V(b50_open)-1.5)+u(V(both_open)-1.5))*8m
C_BEEN been_cap 0 2n
R_BEEN been_cap 0 500meg
D_BEENLO 0 been_cap dclamp
D_BEENHI been_cap been_5v dclamp
V_BEEN5 been_5v 0 5
B_NEEDSET 0 need_cap I=u(V(been_cap)-0.8)*u(1.5-V(both_cl))*2m
B_NEEDCLR need_cap 0 I=(u(V(b27_open)-1.5)+u(V(b50_open)-1.5)+u(V(both_open)-1.5))*8m
C_NEED need_cap 0 2n
R_NEED need_cap 0 500meg
D_NEEDLO 0 need_cap dclamp
D_NEEDHI need_cap need_5v dclamp
V_NEED5 need_5v 0 5
B_REMATE remate_req 0 V=u(V(need_cap)-0.8)*3.3

* Sense resistor (B-source i(V) is not reliable here). 1 ms blanking of inrush.
R_SENSE vin_shared q1a_in {r_sense}
B_ISNS i_sns 0 V=V(vin_shared,q1a_in)/{r_sense}
R_OCF i_sns oc_f 10k
C_OCF oc_f 0 100n
B_OC oc 0 V=u(V(oc_f)-{i_lim})*3.3
B_UVLO uvlo 0 V=u({v_uvlo}-V(vin_shared))*3.3
B_LSET 0 latch_cap I=u(V(oc)-1.5)*2m
B_LCLR latch_cap 0 I=u(V(both_open)-1.5)*u({v_safe}-V(v_branch))*8m
C_LT latch_cap 0 2n
R_LT latch_cap 0 500meg
D_LTLO 0 latch_cap dclamp
D_LTHI latch_cap latch_5v dclamp
V_LT5 latch_5v 0 5
B_LATCH latch 0 V=u(V(latch_cap)-0.8)*3.3

* Q1 EN: S1 AND S2 AND NOT remate_req AND NOT latch AND NOT uvlo AND NOT q1_open.
* p08_force is deliberately omitted.
B_EN_LOGIC en_logic 0 V=u(V(both_cl)-1.5)*u(1.5-V(remate_req))*u(1.5-V(latch))*u(1.5-V(uvlo))*u(1.5-V(q1_open))*3.3
R_EN en_logic q1_en 100
C_EN q1_en 0 200p

* Q1 safety assembly: two series isolation channels + independent discharge.
S_Q1A q1a_in mid q1_en 0 SWQ
S_Q1B mid v_branch q1_en 0 SWQ
S_Q1A_SH q1a_in mid q1a_short 0 SWS
S_Q1B_SH mid v_branch q1b_short 0 SWS
B_EN_N en_n 0 V=u(1.5-V(q1_en))*3.3
B_DCHG_EN dchg_en 0 V=u(V(en_n)-1.5)*u(1.5-V(dchg_open))*3.3
S_DCHG v_branch 0 dchg_en 0 SWD
S_LSHORT v_branch 0 load_short 0 SWS
C_LOAD v_branch 0 {c_load}
R_LOAD v_branch 0 {r_load}

B_ISO iso_en 0 V=u(V(q1_en)-1.5)*3.3
S_SDA sda_rail sda_br iso_en 0 SWL
S_SCL scl_rail scl_br iso_en 0 SWL
S_UID uid_rail uid_br iso_en 0 SWL
S_P08iso p08_rail p08_br iso_en 0 SWL
R_SDA_PD sda_rail 0 100k
R_SCL_PD scl_rail 0 100k
R_UID_PD uid_rail 0 100k
R_P08_PD p08_rail 0 100k
R_SDA_BR sda_br 0 100k
R_SCL_BR scl_br 0 100k
R_UID_BR uid_br 0 100k
R_P08_BRPD p08_br 0 100k

* Diagnostic FAULT_N (active low) from hardware latch. Not an enable input.
B_P08DIAG p08_diag 0 V=3.3-u(V(latch)-1.5)*3.3
R_P08BR p08_diag p08_br 1k
