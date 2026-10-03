/* A disc title is only written when the old one could be read. SPDX-License-Identifier: LGPL-2.1-or-later */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "libnetmd.h"
static unsigned char last[300], write_req[300];
static int calls, read_result, read_status;
static const char *old_title;
int netmd_exch_message(netmd_dev_handle *dev,unsigned char *cmd,const size_t length,unsigned char *out) {
    (void)dev;assert(length<=sizeof(last));memcpy(last,cmd,length);if(cmd[2]==0x07)memcpy(write_req,cmd,length);memset(out,0,255);
    if(calls++==0) {
        /* The title read that tells the write how many bytes to replace. */
        assert(cmd[2]==0x06);
        if(read_result<0)return read_result;
        out[0]=(unsigned char)read_status;memcpy(out+25,old_title,strlen(old_title));
        return 25+(int)strlen(old_title);
    }
    out[0]=NETMD_STATUS_ACCEPTED;return 10;
}
int main(void) {
    char title[]="0;New//1-2;A//";
    netmd_set_log_level(NETMD_LOG_NONE);
    /* Hardware report: a busy recorder failed the read. Never write with a guessed length. */
    calls=0;read_result=NETMDERR_USB;assert(netmd_set_disc_title(NULL,title,strlen(title))==NETMD_TITLE_NOT_WRITTEN);assert(calls==1);
    calls=0;read_result=NETMDERR_TIMEOUT;assert(netmd_set_disc_title(NULL,title,strlen(title))==NETMD_TITLE_NOT_WRITTEN);assert(calls==1);
    /* The recorder reporting no title still allows a write that replaces 0 bytes. */
    calls=0;read_result=0;read_status=NETMD_STATUS_REJECTED;old_title="";
    assert(netmd_set_disc_title(NULL,title,strlen(title))>=0);assert(calls==6 && write_req[20]==0);
    /* A readable title is replaced by exactly its length. */
    calls=0;read_status=NETMD_STATUS_ACCEPTED;old_title="0;Old title//1-3;A//";
    assert(netmd_set_disc_title(NULL,title,strlen(title))>=0);assert(calls==6);
    assert(write_req[16]==strlen(title) && write_req[20]==strlen(old_title) && memcmp(write_req+21,title,strlen(title))==0);
    puts("Native disc title write: 4 cases passed (unreadable title writes nothing).");
}
