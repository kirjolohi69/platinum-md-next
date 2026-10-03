/* A track move is sent to the recorder exactly once. SPDX-License-Identifier: LGPL-2.1-or-later */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "libnetmd.h"
static unsigned char sent[8][32];
static size_t lengths[8];
static int calls, result;
int netmd_exch_message(netmd_dev_handle *dev,unsigned char *cmd,const size_t length,unsigned char *out) {
    (void)dev;assert(calls<8 && length<=sizeof(sent[0]));
    memcpy(sent[calls],cmd,length);lengths[calls++]=length;memset(out,0,255);return result;
}
int main(void) {
    netmd_set_log_level(NETMD_LOG_NONE);
    /* Hardware report: sending the request twice moved two tracks to the end. */
    calls=0;result=16;assert(netmd_move_track(NULL,10,15)==1);
    assert(calls==2 && lengths[0]==8 && lengths[1]==16);
    assert(sent[1][2]==0x43 && sent[1][9]==0 && sent[1][10]==10 && sent[1][14]==0 && sent[1][15]==15);
    calls=0;result=-1;assert(netmd_move_track(NULL,3,0)==0);assert(calls==2);
    puts("Native track move: 2 cases passed (one request per move, failures reported).");
}
